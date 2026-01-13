'use client';

import { useState, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { TransactionCard } from './transaction-card';
import { formatCurrency } from '@/lib/utils';
import type { Transaction } from '@/types';
import type { TrafficLightZone } from '@/constants/traffic-light';

interface UncategorizedPoolProps {
  transactions: Transaction[];
  aiSuggestions?: Map<string, { zone: TrafficLightZone; confidence: number; reasoning: string }>;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onAutoCategorize?: (transactionId: string, zone: TrafficLightZone) => void;
}

type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';
type ZoneFilter = 'ALL' | 'GREEN' | 'YELLOW' | 'RED';

export function UncategorizedPool({
  transactions,
  aiSuggestions,
  selectedIds = new Set(),
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  onAutoCategorize,
}: UncategorizedPoolProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [zoneFilter, setZoneFilter] = useState<ZoneFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [showFilters, setShowFilters] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: 'UNCATEGORIZED',
    data: {
      type: 'zone',
      zone: 'UNCATEGORIZED',
    },
  });

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.merchantName?.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.defaultCategory?.toLowerCase().includes(query)
      );
    }

    // Zone filter (by AI suggestion)
    if (zoneFilter !== 'ALL' && aiSuggestions) {
      result = result.filter((t) => {
        const suggestion = aiSuggestions.get(t.id);
        return suggestion?.zone === zoneFilter;
      });
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'date-asc':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'amount-desc':
          return Math.abs(Number(b.amount)) - Math.abs(Number(a.amount));
        case 'amount-asc':
          return Math.abs(Number(a.amount)) - Math.abs(Number(b.amount));
        default:
          return 0;
      }
    });

    return result;
  }, [transactions, searchQuery, zoneFilter, sortBy, aiSuggestions]);

  const totalAmount = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
  const filteredAmount = filteredTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
  const isFiltered = searchQuery || zoneFilter !== 'ALL';

  // Count selected in this pool
  const selectedInPool = filteredTransactions.filter((t) => selectedIds.has(t.id)).length;
  const allFilteredSelected = filteredTransactions.length > 0 && selectedInPool === filteredTransactions.length;

  const clearFilters = () => {
    setSearchQuery('');
    setZoneFilter('ALL');
  };

  const toggleSelectionMode = () => {
    if (selectionMode) {
      onClearSelection?.();
    }
    setSelectionMode(!selectionMode);
  };

  const handleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      onClearSelection?.();
    } else {
      // Select all filtered transactions
      filteredTransactions.forEach((t) => {
        if (!selectedIds.has(t.id)) {
          onToggleSelection?.(t.id);
        }
      });
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col h-full min-h-[400px] border
        transition-all duration-300
        ${isOver ? 'border-[#FFC700] shadow-[0_0_40px_rgba(255,199,0,0.2)]' : 'border-[#424242]'}
        bg-[#111820]
      `}
    >
      {/* Header */}
      <div className="p-4 bg-[#FFC700]/5 border-b border-[#424242]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Inbox icon */}
            <div className="w-10 h-10 bg-[#FFC700]/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#FFC700]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Inbox</h3>
              <p className="text-sm text-[#6B7280]">Needs your attention</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white">{transactions.length}</p>
            <p className="text-sm text-[#6B7280]">{formatCurrency(totalAmount)}</p>
          </div>
        </div>

        {/* Progress indicator */}
        {transactions.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm text-[#6B7280] mb-1">
              <span>Uncategorized</span>
              <span>{transactions.length} remaining</span>
            </div>
            <div className="h-1.5 bg-[#424242] overflow-hidden">
              <div
                className="h-full bg-[#22C55E] transition-all duration-500"
                style={{ width: `${Math.max(5, 100 - transactions.length * 5)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      {transactions.length > 0 && (
        <div className="px-3 py-2 border-b border-[#424242] space-y-2">
          {/* Search + Toggle + Select Mode */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search merchants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-[#000000] border border-[#424242] text-white placeholder-[#6B7280] focus:outline-none focus:border-[#FFC700] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#6B7280] hover:text-white"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Select mode toggle */}
            <button
              onClick={toggleSelectionMode}
              className={`p-2 border transition-colors ${
                selectionMode || selectedIds.size > 0
                  ? 'bg-[#22C55E]/20 border-[#22C55E] text-[#22C55E]'
                  : 'bg-[#000000] border-[#424242] text-[#6B7280] hover:text-white'
              }`}
              title="Multi-select mode"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 border transition-colors ${
                showFilters || isFiltered
                  ? 'bg-[#FFC700]/20 border-[#FFC700] text-[#FFC700]'
                  : 'bg-[#000000] border-[#424242] text-[#6B7280] hover:text-white'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
          </div>

          {/* Selection controls */}
          {(selectionMode || selectedIds.size > 0) && (
            <div className="flex items-center justify-between py-1 px-1 bg-[#22C55E]/10 border border-[#22C55E]/30">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAllFiltered}
                  className="flex items-center gap-2 px-2 py-1 text-sm text-[#22C55E] hover:bg-[#22C55E]/20 rounded transition-colors"
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                    allFilteredSelected ? 'bg-[#22C55E] border-[#22C55E]' : 'border-[#22C55E]'
                  }`}>
                    {allFilteredSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  {allFilteredSelected ? 'Deselect all' : 'Select all'}
                </button>
                {selectedInPool > 0 && (
                  <span className="text-sm text-[#22C55E]">
                    {selectedInPool} selected
                  </span>
                )}
              </div>
              <p className="text-xs text-[#22C55E]/70 mr-2">
                Drag any selected to move all
              </p>
            </div>
          )}

          {/* Expanded Filters */}
          {showFilters && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {/* AI Suggestion Filter */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-[#6B7280]">AI suggests:</span>
                <div className="flex overflow-hidden border border-[#424242]">
                  {(['ALL', 'GREEN', 'YELLOW', 'RED'] as const).map((zone) => (
                    <button
                      key={zone}
                      onClick={() => setZoneFilter(zone)}
                      className={`px-2 py-1 text-xs font-medium transition-colors ${
                        zoneFilter === zone
                          ? zone === 'GREEN'
                            ? 'bg-[#22C55E] text-white'
                            : zone === 'YELLOW'
                            ? 'bg-[#EAB308] text-black'
                            : zone === 'RED'
                            ? 'bg-[#EF4444] text-white'
                            : 'bg-[#FFC700] text-black'
                          : 'bg-[#000000] text-[#6B7280] hover:text-white'
                      }`}
                    >
                      {zone === 'ALL' ? 'All' : zone.charAt(0) + zone.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-[#6B7280]">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-2 py-1 text-xs bg-[#000000] border border-[#424242] text-white focus:outline-none focus:border-[#FFC700]"
                >
                  <option value="date-desc">Newest</option>
                  <option value="date-asc">Oldest</option>
                  <option value="amount-desc">Highest $</option>
                  <option value="amount-asc">Lowest $</option>
                </select>
              </div>

              {/* Clear filters */}
              {isFiltered && (
                <button
                  onClick={clearFilters}
                  className="ml-auto px-2 py-1 text-xs text-[#EF4444] hover:text-[#F87171] transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Filter status */}
          {isFiltered && (
            <div className="flex items-center justify-between text-xs text-[#6B7280] pt-1">
              <span>
                Showing {filteredTransactions.length} of {transactions.length}
              </span>
              <span>{formatCurrency(filteredAmount)}</span>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-3 overflow-y-auto">
        <div className="space-y-2">
          {filteredTransactions.map((transaction) => (
            <TransactionCard
              key={transaction.id}
              transaction={transaction}
              aiSuggestion={aiSuggestions?.get(transaction.id)}
              isSelected={selectedIds.has(transaction.id)}
              onToggleSelection={onToggleSelection}
              selectionMode={selectionMode || selectedIds.size > 0}
            />
          ))}

          {/* No results from filter */}
          {filteredTransactions.length === 0 && transactions.length > 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-12 h-12 bg-[#FFC700]/20 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-[#FFC700]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h4 className="text-base font-semibold text-white mb-1">No matches</h4>
              <p className="text-sm text-[#6B7280] text-center">
                Try adjusting your filters
              </p>
              <button
                onClick={clearFilters}
                className="mt-3 px-4 py-2 text-sm text-[#FFC700] hover:text-white transition-colors"
              >
                Clear all filters
              </button>
            </div>
          )}

          {/* Empty state - success! */}
          {transactions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 bg-[#22C55E]/20 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="text-xl font-semibold text-white mb-1">Inbox Zero</h4>
              <p className="text-base text-[#6B7280] text-center">
                All transactions categorized.
              </p>
              <p className="text-base text-[#22C55E] mt-2">
                Discipline looks good on you.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions footer */}
      {transactions.length > 0 && (
        <div className="p-3 border-t border-[#424242]">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#6B7280]">
              {selectedIds.size > 0
                ? `Drag to move ${selectedIds.size} items`
                : 'Drag to categorize'
              }
            </p>
            {aiSuggestions && aiSuggestions.size > 0 && onAutoCategorize && (
              <button
                className="text-sm text-[#FFC700] hover:text-white transition-colors font-medium"
                onClick={() => {
                  // Auto-categorize all transactions that have AI suggestions
                  transactions.forEach((txn) => {
                    const suggestion = aiSuggestions.get(txn.id);
                    if (suggestion) {
                      onAutoCategorize(txn.id, suggestion.zone);
                    }
                  });
                }}
              >
                Auto-categorize {aiSuggestions.size} items
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { UncategorizedPool as default };
