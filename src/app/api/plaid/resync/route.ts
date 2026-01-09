// Resync all Plaid connections for the authenticated user
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { plaidClient } from '@/lib/plaid/client';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all connections for user
    const connections = await prisma.plaidConnection.findMany({
      where: { userId: session.user.id, isActive: true },
    });

    if (connections.length === 0) {
      return NextResponse.json({ error: 'No connections found' }, { status: 404 });
    }

    let totalAdded = 0;
    let totalModified = 0;
    let totalRemoved = 0;

    for (const connection of connections) {
      // Update status
      await prisma.plaidConnection.update({
        where: { id: connection.id },
        data: { syncStatus: 'syncing' },
      });

      try {
        let hasMore = true;
        let cursor = connection.cursor || undefined;

        while (hasMore) {
          const response = await plaidClient.transactionsSync({
            access_token: connection.accessToken,
            cursor,
            count: 500,
          });

          const { added, modified, removed, has_more, next_cursor } = response.data;

          // Process added transactions
          for (const tx of added) {
            if (tx.pending) continue;

            await prisma.transaction.upsert({
              where: {
                externalId_userId: {
                  externalId: tx.transaction_id,
                  userId: session.user.id,
                },
              },
              update: {
                amount: Math.abs(tx.amount),
                description: tx.name,
                merchantName: tx.merchant_name || tx.name,
                date: new Date(tx.date),
                defaultCategory: tx.personal_finance_category?.primary || null,
                pending: tx.pending,
                isRecurring: tx.personal_finance_category?.detailed?.includes('SUBSCRIPTION') || false,
              },
              create: {
                userId: session.user.id,
                plaidConnectionId: connection.id,
                externalId: tx.transaction_id,
                amount: Math.abs(tx.amount),
                description: tx.name,
                merchantName: tx.merchant_name || tx.name,
                date: new Date(tx.date),
                source: 'PLAID',
                defaultCategory: tx.personal_finance_category?.primary || null,
                pending: tx.pending,
                isRecurring: tx.personal_finance_category?.detailed?.includes('SUBSCRIPTION') || false,
              },
            });
            totalAdded++;
          }

          // Process modified
          for (const tx of modified) {
            await prisma.transaction.updateMany({
              where: {
                externalId: tx.transaction_id,
                userId: session.user.id,
              },
              data: {
                amount: Math.abs(tx.amount),
                description: tx.name,
                merchantName: tx.merchant_name || tx.name,
                date: new Date(tx.date),
                pending: tx.pending,
              },
            });
            totalModified++;
          }

          // Process removed
          for (const tx of removed) {
            await prisma.transaction.deleteMany({
              where: {
                externalId: tx.transaction_id,
                userId: session.user.id,
              },
            });
            totalRemoved++;
          }

          hasMore = has_more;
          cursor = next_cursor;
        }

        // Update connection
        await prisma.plaidConnection.update({
          where: { id: connection.id },
          data: {
            cursor,
            syncStatus: 'synced',
            lastSyncedAt: new Date(),
            errorCode: null,
          },
        });
      } catch (error) {
        console.error('Sync error for connection:', connection.id, error);
        await prisma.plaidConnection.update({
          where: { id: connection.id },
          data: {
            syncStatus: 'error',
            errorCode: 'SYNC_FAILED',
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      added: totalAdded,
      modified: totalModified,
      removed: totalRemoved,
    });
  } catch (error) {
    console.error('Resync error:', error);
    return NextResponse.json({ error: 'Resync failed' }, { status: 500 });
  }
}
