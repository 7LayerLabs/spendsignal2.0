// Transaction Import API
// Imports transactions from CSV data into the database with auto-categorization

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { autoCategorize } from '@/lib/services/auto-categorize';

// Schema for imported transaction
const TransactionSchema = z.object({
  date: z.string(),
  description: z.string(),
  amount: z.number(),
  merchantName: z.string().optional(),
  category: z.string().optional(),
});

const ImportSchema = z.object({
  transactions: z.array(TransactionSchema),
});

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { transactions } = ImportSchema.parse(body);

    if (transactions.length === 0) {
      return NextResponse.json(
        { error: 'No transactions to import' },
        { status: 400 }
      );
    }

    // Prepare transaction data with auto-categorization info
    const txnData = transactions.map((txn) => {
      const merchantName = txn.merchantName || txn.description;
      const autoResult = autoCategorize(merchantName, txn.description, Math.abs(txn.amount));

      return {
        userId: session.user.id,
        amount: Math.abs(txn.amount),
        description: txn.description,
        merchantName: merchantName,
        date: new Date(txn.date),
        source: 'MANUAL' as const,
        defaultCategory: autoResult?.category || txn.category || null,
        pending: false,
        isRecurring: false,
        // Store auto-categorization result for later
        _autoZone: autoResult?.zone || null,
        _autoConfidence: autoResult?.confidence || null,
      };
    });

    // Import transactions to database
    const imported = await prisma.transaction.createMany({
      data: txnData.map(({ _autoZone, _autoConfidence, ...txn }) => txn),
      skipDuplicates: true,
    });

    // Now fetch the created transactions and auto-categorize them
    const recentTransactions = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        source: 'MANUAL',
        createdAt: { gte: new Date(Date.now() - 60000) }, // Last minute
      },
      orderBy: { createdAt: 'desc' },
      take: transactions.length,
    });

    // Create categorizations for all imported transactions
    let categorized = 0;
    for (const txn of recentTransactions) {
      const autoResult = autoCategorize(
        txn.merchantName || '',
        txn.description,
        txn.amount.toNumber()
      );

      // autoCategorize always returns a suggestion now
      try {
        await prisma.userCategorization.upsert({
          where: {
            userId_transactionId: {
              userId: session.user.id,
              transactionId: txn.id,
            },
          },
          update: {
            zone: autoResult.zone,
            aiSuggestedZone: autoResult.zone,
            aiConfidence: autoResult.confidence,
            aiReasoning: autoResult.reasoning,
          },
          create: {
            userId: session.user.id,
            transactionId: txn.id,
            zone: autoResult.zone,
            aiSuggestedZone: autoResult.zone,
            aiConfidence: autoResult.confidence,
            aiReasoning: autoResult.reasoning,
          },
        });
        categorized++;
      } catch (e) {
        console.error('Failed to auto-categorize transaction:', txn.id, e);
      }
    }

    return NextResponse.json({
      success: true,
      imported: imported.count,
      categorized,
      message: `Imported ${imported.count} transactions, auto-categorized ${categorized}`,
    });
  } catch (error) {
    console.error('Import transactions error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid transaction data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to import transactions' },
      { status: 500 }
    );
  }
}
