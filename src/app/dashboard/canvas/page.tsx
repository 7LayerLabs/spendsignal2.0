'use client';

import { useState, useMemo, useCallback } from 'react';
import { TransactionBoard } from '@/components/transactions/transaction-board';
import { SpendingAnalysis } from '@/components/transactions/spending-analysis';
import { useTransactions, useCategorizations } from '@/hooks/use-transactions';
import type { TrafficLightZone } from '@/constants/traffic-light';

const BATCH_SIZE = 15;

export default function CanvasPage() {
  const { transactions: rawTransactions, isLoading, refetch } = useTransactions(90);
  const { categorizations: rawCategorizations, categorize } = useCategorizations();
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(0);

  // Transform transactions to expected format
  const transactions = useMemo(() =>
    rawTransactions.map(t => ({
      id: t.id,
      amount: t.amount,
      description: t.description,
      merchantName: t.merchantName,
      date: new Date(t.date),
      defaultCategory: t.defaultCategory,
      isRecurring: t.isRecurring,
      userId: t.userId,
      source: t.source,
      pending: t.pending,
      createdAt: new Date(t.createdAt),
      updatedAt: new Date(t.updatedAt),
    })), [rawTransactions]);

  // Transform categorizations
  const categorizations = useMemo(() =>
    rawCategorizations.map(c => ({
      transactionId: c.transactionId,
      zone: c.zone,
    })), [rawCategorizations]);

  const handleCategorize = useCallback((transactionId: string, zone: TrafficLightZone) => {
    categorize(transactionId, zone);
  }, [categorize]);

  // Get uncategorized transactions
  const uncategorizedTransactions = useMemo(() =>
    transactions.filter(t => !categorizations.find(c => c.transactionId === t.id)),
    [transactions, categorizations]
  );

  // Split into batches
  const totalBatches = Math.ceil(uncategorizedTransactions.length / BATCH_SIZE);
  const currentBatchTransactions = useMemo(() => {
    const start = currentBatch * BATCH_SIZE;
    return uncategorizedTransactions.slice(start, start + BATCH_SIZE);
  }, [uncategorizedTransactions, currentBatch]);

  // Get already categorized transactions (always show these)
  const categorizedTransactions = useMemo(() =>
    transactions.filter(t => categorizations.find(c => c.transactionId === t.id)),
    [transactions, categorizations]
  );

  // Combine: current batch of uncategorized + all categorized
  const visibleTransactions = useMemo(() =>
    [...currentBatchTransactions, ...categorizedTransactions],
    [currentBatchTransactions, categorizedTransactions]
  );

  const uncategorizedCount = uncategorizedTransactions.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-[#22C55E] border-t-transparent animate-spin" />
          <p className="text-[#9BA4B0]">Loading transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Simple header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Categorize Your Spending</h1>
          <p className="text-sm text-[#9BA4B0]">
            {uncategorizedCount > 0
              ? `${currentBatchTransactions.length} of ${uncategorizedCount} remaining`
              : 'All done!'}
          </p>
        </div>

        {/* Refresh button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 text-[#9BA4B0] hover:text-white hover:bg-white/5 transition-colors"
            title="Refresh transactions"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Batch navigation - only show if multiple batches */}
      {totalBatches > 1 && uncategorizedCount > 0 && (
        <div className="flex items-center justify-center gap-4 py-2">
          <button
            onClick={() => setCurrentBatch(Math.max(0, currentBatch - 1))}
            disabled={currentBatch === 0}
            className="p-2 text-[#9BA4B0] hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            {Array.from({ length: totalBatches }, (_, i) => (
              <button
                key={i}
                onClick={() => setCurrentBatch(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentBatch
                    ? 'bg-[#22C55E]'
                    : 'bg-[#424242] hover:bg-[#9BA4B0]'
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => setCurrentBatch(Math.min(totalBatches - 1, currentBatch + 1))}
            disabled={currentBatch >= totalBatches - 1}
            className="p-2 text-[#9BA4B0] hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Main canvas board - full width, clean */}
      <TransactionBoard
        transactions={visibleTransactions}
        categorizations={categorizations}
        onCategorize={handleCategorize}
      />

      {/* Show analysis toggle - only appears after some categorization */}
      {uncategorizedCount < transactions.length && (
        <div className="pt-4">
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className="flex items-center gap-2 text-sm text-[#9BA4B0] hover:text-white transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showAnalysis ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {showAnalysis ? 'Hide' : 'Show'} Spending Analysis
          </button>

          {showAnalysis && (
            <div className="mt-4">
              <SpendingAnalysis
                transactions={transactions}
                categorizations={categorizations}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
