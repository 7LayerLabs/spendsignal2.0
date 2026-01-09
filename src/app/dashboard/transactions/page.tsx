'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useTransactions, useCategorizations } from '@/hooks/use-transactions';
import { formatCurrency, formatRelativeDate } from '@/lib/utils';
import { ZONE_CONFIG, type TrafficLightZone } from '@/constants/traffic-light';

type SortField = 'date' | 'amount' | 'merchant' | 'category';
type SortDirection = 'asc' | 'desc';
type ZoneFilter = 'ALL' | 'UNCATEGORIZED' | 'GREEN' | 'YELLOW' | 'RED';

function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
  if (sortField !== field) {
    return (
      <svg className="w-4 h-4 text-[#6B7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  }
  return sortDirection === 'asc' ? (
    <svg className="w-4 h-4 text-[#FFC700]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  ) : (
    <svg className="w-4 h-4 text-[#FFC700]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default function TransactionsPage() {
  const { transactions: rawTransactions, isLoading } = useTransactions(90);
  const { categorizations, categorize } = useCategorizations();

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
    })), [rawTransactions]);

  const [searchQuery, setSearchQuery] = useState('');
  const [zoneFilter, setZoneFilter] = useState<ZoneFilter>('ALL');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Create categorization map
  const categorizationMap = useMemo(() => {
    const map = new Map<string, TrafficLightZone>();
    categorizations.forEach((c) => map.set(c.transactionId, c.zone as TrafficLightZone));
    return map;
  }, [categorizations]);

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

    // Zone filter
    if (zoneFilter !== 'ALL') {
      result = result.filter((t) => {
        const zone = categorizationMap.get(t.id);
        if (zoneFilter === 'UNCATEGORIZED') {
          return !zone;
        }
        return zone === zoneFilter;
      });
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'amount':
          comparison = Math.abs(Number(a.amount)) - Math.abs(Number(b.amount));
          break;
        case 'merchant':
          comparison = (a.merchantName || '').localeCompare(b.merchantName || '');
          break;
        case 'category':
          comparison = (a.defaultCategory || '').localeCompare(b.defaultCategory || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [transactions, searchQuery, zoneFilter, sortField, sortDirection, categorizationMap]);

  // Stats
  const stats = useMemo(() => {
    const total = transactions.length;
    const uncategorized = transactions.filter((t) => !categorizationMap.has(t.id)).length;
    const green = transactions.filter((t) => categorizationMap.get(t.id) === 'GREEN').length;
    const yellow = transactions.filter((t) => categorizationMap.get(t.id) === 'YELLOW').length;
    const red = transactions.filter((t) => categorizationMap.get(t.id) === 'RED').length;

    const totalAmount = transactions.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    const greenAmount = transactions
      .filter((t) => categorizationMap.get(t.id) === 'GREEN')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    const yellowAmount = transactions
      .filter((t) => categorizationMap.get(t.id) === 'YELLOW')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    const redAmount = transactions
      .filter((t) => categorizationMap.get(t.id) === 'RED')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    return { total, uncategorized, green, yellow, red, totalAmount, greenAmount, yellowAmount, redAmount };
  }, [transactions, categorizationMap]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleCategorize = (transactionId: string, zone: TrafficLightZone) => {
    categorize(transactionId, zone);
    setEditingId(null);
  };

  const getZoneBadge = (transactionId: string) => {
    const zone = categorizationMap.get(transactionId);
    if (!zone) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-[#FFC700]/20 text-[#FFC700]">
          Uncategorized
        </span>
      );
    }
    const config = ZONE_CONFIG[zone];
    const colors: Record<TrafficLightZone, string> = {
      GREEN: 'bg-[#22C55E]/20 text-[#22C55E]',
      YELLOW: 'bg-[#EAB308]/20 text-[#EAB308]',
      RED: 'bg-[#EF4444]/20 text-[#EF4444]',
      UNCATEGORIZED: 'bg-[#FFC700]/20 text-[#FFC700]',
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${colors[zone]}`}>
        {config.label}
      </span>
    );
  };

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
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 -ml-2  text-[#9BA4B0] hover:text-[white] hover:bg-[white/5] transition-colors lg:hidden"
            aria-label="Back to Dashboard"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[white]">Transactions</h1>
            <p className="text-sm text-[#9BA4B0] mt-1">
              {stats.total} transactions over the last 30 days
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/canvas"
            className="px-4 py-2 text-sm font-medium text-white bg-[#22C55E] hover:bg-[#16A34A] transition-colors"
          >
            Open Canvas
          </Link>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <button
          onClick={() => setZoneFilter('ALL')}
          className={`p-4  border transition-all ${
            zoneFilter === 'ALL'
              ? 'bg-[#FFC700]/10 border-[#FFC700]'
              : 'bg-[#111820] border-[#424242] hover:border-[#FFC700]/50'
          }`}
        >
          <p className="text-xs text-[#6B7280]">Total</p>
          <p className="text-2xl font-bold text-[white]">{stats.total}</p>
          <p className="text-sm text-[#6B7280]">{formatCurrency(stats.totalAmount)}</p>
        </button>

        <button
          onClick={() => setZoneFilter('UNCATEGORIZED')}
          className={`p-4  border transition-all ${
            zoneFilter === 'UNCATEGORIZED'
              ? 'bg-[#FFC700]/10 border-[#FFC700]'
              : 'bg-[#111820] border-[#424242] hover:border-[#FFC700]/50'
          }`}
        >
          <p className="text-xs text-[#6B7280]">Uncategorized</p>
          <p className="text-2xl font-bold text-[#FFC700]">{stats.uncategorized}</p>
          <p className="text-sm text-[#6B7280]">Need review</p>
        </button>

        <button
          onClick={() => setZoneFilter('GREEN')}
          className={`p-4  border transition-all ${
            zoneFilter === 'GREEN'
              ? 'bg-[#22C55E]/10 border-[#22C55E]'
              : 'bg-[#111820] border-[#424242] hover:border-[#22C55E]/50'
          }`}
        >
          <p className="text-xs text-[#6B7280]">Essentials</p>
          <p className="text-2xl font-bold text-[#22C55E]">{stats.green}</p>
          <p className="text-sm text-[#6B7280]">{formatCurrency(stats.greenAmount)}</p>
        </button>

        <button
          onClick={() => setZoneFilter('YELLOW')}
          className={`p-4  border transition-all ${
            zoneFilter === 'YELLOW'
              ? 'bg-[#EAB308]/10 border-[#EAB308]'
              : 'bg-[#111820] border-[#424242] hover:border-[#EAB308]/50'
          }`}
        >
          <p className="text-xs text-[#6B7280]">Discretionary</p>
          <p className="text-2xl font-bold text-[#EAB308]">{stats.yellow}</p>
          <p className="text-sm text-[#6B7280]">{formatCurrency(stats.yellowAmount)}</p>
        </button>

        <button
          onClick={() => setZoneFilter('RED')}
          className={`p-4  border transition-all ${
            zoneFilter === 'RED'
              ? 'bg-[#EF4444]/10 border-[#EF4444]'
              : 'bg-[#111820] border-[#424242] hover:border-[#EF4444]/50'
          }`}
        >
          <p className="text-xs text-[#6B7280]">Avoidable</p>
          <p className="text-2xl font-bold text-[#EF4444]">{stats.red}</p>
          <p className="text-sm text-[#6B7280]">{formatCurrency(stats.redAmount)}</p>
        </button>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 text-base bg-[#111820] border border-[#424242]  text-[white] placeholder-[#6B7280] focus:outline-none focus:border-[#FFC700] transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
          <span>Showing</span>
          <span className="text-[white] font-medium">{filteredTransactions.length}</span>
          <span>of</span>
          <span className="text-[white] font-medium">{transactions.length}</span>
        </div>
      </div>

      {/* Transactions table */}
      <div className=" border border-[#424242] overflow-hidden">
        {/* Table header */}
        <div className="bg-[#0D1117] border-b border-[#424242]">
          <div className="grid grid-cols-12 gap-4 px-4 py-3 text-sm font-medium text-[#6B7280]">
            <button
              onClick={() => handleSort('date')}
              className="col-span-2 flex items-center gap-1 hover:text-[white] transition-colors"
            >
              Date <SortIcon field="date" sortField={sortField} sortDirection={sortDirection} />
            </button>
            <button
              onClick={() => handleSort('merchant')}
              className="col-span-3 flex items-center gap-1 hover:text-[white] transition-colors"
            >
              Merchant <SortIcon field="merchant" sortField={sortField} sortDirection={sortDirection} />
            </button>
            <button
              onClick={() => handleSort('category')}
              className="col-span-2 flex items-center gap-1 hover:text-[white] transition-colors"
            >
              Category <SortIcon field="category" sortField={sortField} sortDirection={sortDirection} />
            </button>
            <button
              onClick={() => handleSort('amount')}
              className="col-span-2 flex items-center gap-1 justify-end hover:text-[white] transition-colors"
            >
              Amount <SortIcon field="amount" sortField={sortField} sortDirection={sortDirection} />
            </button>
            <div className="col-span-3 text-right">Zone</div>
          </div>
        </div>

        {/* Table body */}
        <div className="divide-y divide-[#424242] bg-[#111820]">
          {filteredTransactions.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-[#6B7280]">No transactions found</p>
            </div>
          ) : (
            filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="grid grid-cols-12 gap-4 px-4 py-4 items-center hover:bg-[white/5] transition-colors"
              >
                {/* Date */}
                <div className="col-span-2">
                  <p className="text-sm text-[white]">
                    {new Date(transaction.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="text-xs text-[#6B7280]">
                    {formatRelativeDate(new Date(transaction.date))}
                  </p>
                </div>

                {/* Merchant */}
                <div className="col-span-3">
                  <p className="text-base font-medium text-[white] truncate">
                    {transaction.merchantName || 'Unknown'}
                  </p>
                  {transaction.isRecurring && (
                    <span className="inline-flex items-center gap-1 text-xs text-[#FFC700]">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Recurring
                    </span>
                  )}
                </div>

                {/* Category */}
                <div className="col-span-2">
                  <p className="text-sm text-[#9BA4B0] truncate">
                    {transaction.defaultCategory || '-'}
                  </p>
                </div>

                {/* Amount */}
                <div className="col-span-2 text-right">
                  <p className="text-base font-semibold text-[white]">
                    {formatCurrency(Number(transaction.amount))}
                  </p>
                </div>

                {/* Zone */}
                <div className="col-span-3 flex items-center justify-end gap-2">
                  {editingId === transaction.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCategorize(transaction.id, 'GREEN')}
                        className="p-2  bg-[#22C55E]/20 hover:bg-[#22C55E]/30 transition-colors"
                        title="Essential"
                      >
                        <div className="w-4 h-4 rounded-full bg-[#22C55E]" />
                      </button>
                      <button
                        onClick={() => handleCategorize(transaction.id, 'YELLOW')}
                        className="p-2  bg-[#EAB308]/20 hover:bg-[#EAB308]/30 transition-colors"
                        title="Discretionary"
                      >
                        <div className="w-4 h-4 rounded-full bg-[#EAB308]" />
                      </button>
                      <button
                        onClick={() => handleCategorize(transaction.id, 'RED')}
                        className="p-2  bg-[#EF4444]/20 hover:bg-[#EF4444]/30 transition-colors"
                        title="Avoidable"
                      >
                        <div className="w-4 h-4 rounded-full bg-[#EF4444]" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-2 text-[#6B7280] hover:text-[white] transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <>
                      {getZoneBadge(transaction.id)}
                      <button
                        onClick={() => setEditingId(transaction.id)}
                        className="p-1.5 text-[#6B7280] hover:text-[white] hover:bg-[white/5]  transition-colors"
                        title="Change zone"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer summary */}
      {filteredTransactions.length > 0 && (
        <div className="flex items-center justify-between p-4  bg-[#111820] border border-[#424242]">
          <p className="text-sm text-[#6B7280]">
            {zoneFilter === 'ALL' ? 'All transactions' : `${zoneFilter.toLowerCase()} transactions`}
          </p>
          <p className="text-lg font-semibold text-[white]">
            {formatCurrency(
              filteredTransactions.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)
            )}
          </p>
        </div>
      )}
    </div>
  );
}
