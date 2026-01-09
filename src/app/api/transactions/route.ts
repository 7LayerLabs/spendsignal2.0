// Transactions API
// Fetches transactions for the authenticated user

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30', 10);
    const source = searchParams.get('source'); // 'PLAID', 'DEMO', 'MANUAL', or null for all

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build where clause
    const where: {
      userId: string;
      date: { gte: Date; lte: Date };
      source?: 'PLAID' | 'DEMO' | 'MANUAL';
    } = {
      userId: session.user.id,
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (source && ['PLAID', 'DEMO', 'MANUAL'].includes(source)) {
      where.source = source as 'PLAID' | 'DEMO' | 'MANUAL';
    }

    // Fetch transactions with categorizations
    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        categorization: {
          select: {
            zone: true,
            note: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Transform for frontend
    const transformedTransactions = transactions.map((t) => ({
      id: t.id,
      userId: t.userId,
      amount: t.amount.toNumber(),
      description: t.description,
      merchantName: t.merchantName,
      date: t.date.toISOString(),
      source: t.source,
      defaultCategory: t.defaultCategory,
      pending: t.pending,
      isRecurring: t.isRecurring,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      zone: t.categorization?.zone || null,
    }));

    return NextResponse.json({
      transactions: transformedTransactions,
      count: transformedTransactions.length,
    });
  } catch (error) {
    console.error('Fetch transactions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
