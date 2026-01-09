// Categorizations API
// Handles fetching and creating/updating categorizations

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const categorizations = await prisma.userCategorization.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        transactionId: true,
        zone: true,
        note: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ categorizations });
  } catch (error) {
    console.error('Fetch categorizations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categorizations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { transactionId, zone, note } = body;

    if (!transactionId || !zone) {
      return NextResponse.json(
        { error: 'transactionId and zone are required' },
        { status: 400 }
      );
    }

    if (!['GREEN', 'YELLOW', 'RED', 'UNCATEGORIZED'].includes(zone)) {
      return NextResponse.json(
        { error: 'Invalid zone' },
        { status: 400 }
      );
    }

    // Verify transaction belongs to user
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId: session.user.id,
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Upsert categorization
    const categorization = await prisma.userCategorization.upsert({
      where: {
        transactionId,
      },
      update: {
        zone,
        note: note || null,
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        transactionId,
        zone,
        note: note || null,
      },
    });

    return NextResponse.json({ categorization });
  } catch (error) {
    console.error('Create categorization error:', error);
    return NextResponse.json(
      { error: 'Failed to save categorization' },
      { status: 500 }
    );
  }
}
