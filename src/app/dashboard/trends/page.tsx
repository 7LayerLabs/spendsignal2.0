'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useTransactions, useCategorizations } from '@/hooks/use-transactions';
import { useIncome } from '@/hooks/use-income';
import { formatCurrency } from '@/lib/utils';
import { IncomeSettingsModal } from '@/components/income/income-settings-modal';
import { useSession } from 'next-auth/react';
import type { TrafficLightZone } from '@/constants/traffic-light';

const ZONE_COLORS = {
  GREEN: '#22C55E',
  YELLOW: '#EAB308',
  RED: '#EF4444',
  UNCATEGORIZED: '#3B82F6',
};

type TimeRange = '7d' | '14d' | '30d';

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#111820] border border-[#424242]  p-3 shadow-xl">
        <p className="text-sm text-[white] font-medium mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4 text-sm">
            <span style={{ color: entry.color }}>{entry.name}</span>
            <span className="text-[white] font-medium">{formatCurrency(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export default function TrendsPage() {
  const { data: session } = useSession();
  const { transactions: rawTransactions, isLoading } = useTransactions(90);
  const { categorizations: rawCategorizations } = useCategorizations();
  const userId = session?.user?.id || 'demo-user';
  const { calculations: incomeCalc, hasActiveIncome } = useIncome(userId);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [showIncomeModal, setShowIncomeModal] = useState(false);

  // Transform transactions
  const transactions = useMemo(() =>
    rawTransactions.map(t => ({
      id: t.id,
      amount: t.amount,
      merchantName: t.merchantName,
      date: new Date(t.date),
    })), [rawTransactions]);

  // Create categorization map
  const categorizationMap = useMemo(() => {
    const map = new Map<string, TrafficLightZone>();
    rawCategorizations.forEach((c) => map.set(c.transactionId, c.zone as TrafficLightZone));
    return map;
  }, [rawCategorizations]);

  // Filter transactions by time range
  const filteredTransactions = useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return transactions.filter((t) => new Date(t.date) >= cutoff);
  }, [transactions, timeRange]);

  // Daily spending data for area chart
  const dailyData = useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 30;
    const data: Array<{
      date: string;
      dateLabel: string;
      GREEN: number;
      YELLOW: number;
      RED: number;
      UNCATEGORIZED: number;
      total: number;
    }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const dayTransactions = filteredTransactions.filter(
        (t) => new Date(t.date).toISOString().split('T')[0] === dateStr
      );

      const totals = { GREEN: 0, YELLOW: 0, RED: 0, UNCATEGORIZED: 0 };
      dayTransactions.forEach((t) => {
        const zone = categorizationMap.get(t.id) || 'UNCATEGORIZED';
        totals[zone] += Math.abs(Number(t.amount));
      });

      data.push({
        date: dateStr,
        dateLabel,
        ...totals,
        total: totals.GREEN + totals.YELLOW + totals.RED + totals.UNCATEGORIZED,
      });
    }

    return data;
  }, [filteredTransactions, categorizationMap, timeRange]);

  // Zone distribution for pie chart
  const zoneDistribution = useMemo(() => {
    const totals = { GREEN: 0, YELLOW: 0, RED: 0, UNCATEGORIZED: 0 };
    filteredTransactions.forEach((t) => {
      const zone = categorizationMap.get(t.id) || 'UNCATEGORIZED';
      totals[zone] += Math.abs(Number(t.amount));
    });

    return [
      { name: 'Essentials', value: totals.GREEN, zone: 'GREEN' },
      { name: 'Discretionary', value: totals.YELLOW, zone: 'YELLOW' },
      { name: 'Avoidable', value: totals.RED, zone: 'RED' },
      { name: 'Uncategorized', value: totals.UNCATEGORIZED, zone: 'UNCATEGORIZED' },
    ].filter((d) => d.value > 0);
  }, [filteredTransactions, categorizationMap]);

  // Top merchants by spending
  const topMerchants = useMemo(() => {
    const merchantTotals = new Map<string, { amount: number; zone: TrafficLightZone | 'UNCATEGORIZED'; count: number }>();

    filteredTransactions.forEach((t) => {
      const merchant = t.merchantName || 'Unknown';
      const zone = categorizationMap.get(t.id) || 'UNCATEGORIZED';
      const existing = merchantTotals.get(merchant) || { amount: 0, zone, count: 0 };
      merchantTotals.set(merchant, {
        amount: existing.amount + Math.abs(Number(t.amount)),
        zone: existing.zone,
        count: existing.count + 1,
      });
    });

    return Array.from(merchantTotals.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [filteredTransactions, categorizationMap]);

  // Weekly pattern (day of week)
  const weeklyPattern = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const totals = days.map((day) => ({
      day,
      GREEN: 0,
      YELLOW: 0,
      RED: 0,
      total: 0,
    }));

    filteredTransactions.forEach((t) => {
      const zone = categorizationMap.get(t.id);
      if (!zone || zone === 'UNCATEGORIZED') return;
      const dayIndex = new Date(t.date).getDay();
      const amount = Math.abs(Number(t.amount));
      totals[dayIndex][zone] += amount;
      totals[dayIndex].total += amount;
    });

    return totals;
  }, [filteredTransactions, categorizationMap]);

  // Summary stats
  const summary = useMemo(() => {
    const totals = { GREEN: 0, YELLOW: 0, RED: 0, UNCATEGORIZED: 0, all: 0 };
    filteredTransactions.forEach((t) => {
      const zone = categorizationMap.get(t.id) || 'UNCATEGORIZED';
      const amount = Math.abs(Number(t.amount));
      totals[zone] += amount;
      totals.all += amount;
    });

    const avgDaily = totals.all / (timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 30);
    const projectedMonthly = avgDaily * 30;

    return {
      ...totals,
      avgDaily,
      projectedMonthly,
      greenPercent: totals.all > 0 ? (totals.GREEN / totals.all) * 100 : 0,
      yellowPercent: totals.all > 0 ? (totals.YELLOW / totals.all) * 100 : 0,
      redPercent: totals.all > 0 ? (totals.RED / totals.all) * 100 : 0,
    };
  }, [filteredTransactions, categorizationMap, timeRange]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-[#22C55E] border-t-transparent animate-spin" />
          <p className="text-[#9BA4B0]">Loading trends...</p>
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
            <h1 className="text-2xl font-bold text-[white]">Spending Trends</h1>
            <p className="text-sm text-[#9BA4B0] mt-1">
              Analyze your spending patterns over time
            </p>
          </div>
        </div>

        {/* Time range selector */}
        <div className="flex items-center gap-1 p-1 bg-[#111820]  border border-[#424242]">
          {(['7d', '14d', '30d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 text-sm font-medium  transition-colors ${
                timeRange === range
                  ? 'bg-[#FFC700] text-black'
                  : 'text-[#6B7280] hover:text-[white]'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '14d' ? '14 Days' : '30 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4  bg-[#111820] border border-[#424242]">
          <p className="text-sm text-[#6B7280]">Total Spending</p>
          <p className="text-2xl font-bold text-[white] mt-1">{formatCurrency(summary.all)}</p>
          <p className="text-xs text-[#6B7280] mt-1">
            {formatCurrency(summary.avgDaily)}/day avg
          </p>
        </div>

        <div className="p-4  bg-[#111820] border border-[#424242]">
          <p className="text-sm text-[#6B7280]">Projected Monthly</p>
          <p className="text-2xl font-bold text-[white] mt-1">{formatCurrency(summary.projectedMonthly)}</p>
          <p className="text-xs text-[#6B7280] mt-1">Based on current rate</p>
        </div>

        <div className="p-4  bg-[#111820] border border-[#424242]">
          <p className="text-sm text-[#6B7280]">Could Save</p>
          <p className="text-2xl font-bold text-[#22C55E] mt-1">{formatCurrency(summary.RED)}</p>
          <p className="text-xs text-[#6B7280] mt-1">{Math.round(summary.redPercent)}% of spending</p>
        </div>

        <div className="p-4  bg-[#111820] border border-[#424242]">
          <p className="text-sm text-[#6B7280]">Transactions</p>
          <p className="text-2xl font-bold text-[white] mt-1">{filteredTransactions.length}</p>
          <p className="text-xs text-[#6B7280] mt-1">
            {Math.round(filteredTransactions.length / (timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 30))}/day avg
          </p>
        </div>
      </div>

      {/* Main charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Spending over time - Area chart */}
        <div className="lg:col-span-2 p-6  bg-[#111820] border border-[#424242]">
          <h3 className="text-lg font-semibold text-[white] mb-4">Spending Over Time</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="yellowGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#EAB308" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#424242" />
                <XAxis
                  dataKey="dateLabel"
                  className="fill-[#6B7280]"
                  stroke="currentColor"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  className="fill-[#6B7280]"
                  stroke="currentColor"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="GREEN"
                  name="Essentials"
                  stackId="1"
                  stroke="#22C55E"
                  fill="url(#greenGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="YELLOW"
                  name="Discretionary"
                  stackId="1"
                  stroke="#EAB308"
                  fill="url(#yellowGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="RED"
                  name="Avoidable"
                  stackId="1"
                  stroke="#EF4444"
                  fill="url(#redGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Zone distribution - Pie chart */}
        <div className="p-6  bg-[#111820] border border-[#424242]">
          <h3 className="text-lg font-semibold text-[white] mb-4">Zone Distribution</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={zoneDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {zoneDistribution.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={ZONE_COLORS[entry.zone as keyof typeof ZONE_COLORS]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={{
                    backgroundColor: '#111820',
                    border: '1px solid #424242',
                    borderRadius: '8px',
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => <span className="text-[#9BA4B0] text-sm">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly pattern */}
        <div className="p-6  bg-[#111820] border border-[#424242]">
          <h3 className="text-lg font-semibold text-[white] mb-4">Weekly Pattern</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyPattern} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#424242" />
                <XAxis
                  dataKey="day"
                  className="fill-[#6B7280]"
                  stroke="currentColor"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  className="fill-[#6B7280]"
                  stroke="currentColor"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="GREEN" name="Essentials" stackId="a" fill="#22C55E" radius={[0, 0, 0, 0]} />
                <Bar dataKey="YELLOW" name="Discretionary" stackId="a" fill="#EAB308" radius={[0, 0, 0, 0]} />
                <Bar dataKey="RED" name="Avoidable" stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-[#6B7280] mt-3 text-center">
            See when you spend the most each week
          </p>
        </div>

        {/* Top merchants */}
        <div className="p-6  bg-[#111820] border border-[#424242]">
          <h3 className="text-lg font-semibold text-[white] mb-4">Top Merchants</h3>
          <div className="space-y-3 max-h-[280px] overflow-y-auto">
            {topMerchants.map((merchant, index) => (
              <div key={merchant.name} className="flex items-center gap-3">
                <span className="text-sm text-[#6B7280] w-5">{index + 1}</span>
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: ZONE_COLORS[merchant.zone] }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[white] truncate">{merchant.name}</p>
                  <p className="text-xs text-[#6B7280]">{merchant.count} transactions</p>
                </div>
                <p className="text-sm font-medium text-[white]">{formatCurrency(merchant.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Insights section */}
      <div className="p-6  bg-[#111820] border border-[#424242]">
        <h3 className="text-lg font-semibold text-[white] mb-4">Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Insight 1 */}
          <div className="p-4  bg-[#0D1117] border border-[#424242]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-[#22C55E]/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm font-medium text-[white]">Essentials Ratio</span>
            </div>
            <p className="text-2xl font-bold text-[#22C55E]">{Math.round(summary.greenPercent)}%</p>
            <p className="text-xs text-[#6B7280] mt-1">
              {summary.greenPercent >= 50
                ? 'Good foundation. Essentials are covered.'
                : 'Consider prioritizing essential spending.'}
            </p>
          </div>

          {/* Insight 2 */}
          <div className="p-4  bg-[#0D1117] border border-[#424242]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-[#EF4444]/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#EF4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-[white]">Red Zone Alert</span>
            </div>
            <p className="text-2xl font-bold text-[#EF4444]">{formatCurrency(summary.RED)}</p>
            <p className="text-xs text-[#6B7280] mt-1">
              {summary.redPercent > 20
                ? `That's ${Math.round(summary.redPercent)}% of spending. Cut this.`
                : summary.redPercent > 10
                ? 'Room for improvement. Review these purchases.'
                : 'Keeping impulse spending low. Good discipline.'}
            </p>
          </div>

          {/* Insight 3 */}
          <div className="p-4  bg-[#0D1117] border border-[#424242]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-[#3B82F6]/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <span className="text-sm font-medium text-[white]">Yearly Projection</span>
            </div>
            <p className="text-2xl font-bold text-[white]">{formatCurrency(summary.projectedMonthly * 12)}</p>
            <p className="text-xs text-[#6B7280] mt-1">
              Potential yearly savings: {formatCurrency(summary.RED * 12)} if you eliminate red zone.
            </p>
          </div>
        </div>
      </div>

      {/* Income vs Spending Comparison */}
      <IncomeSpendingComparison
        monthlyIncome={incomeCalc.monthlyIncome}
        projectedSpending={summary.projectedMonthly}
        hasIncome={hasActiveIncome}
        onSetupIncome={() => setShowIncomeModal(true)}
      />

      {/* Premium badge */}
      <div className="flex items-center justify-center gap-2 text-sm text-[#6B7280]">
        <svg className="w-4 h-4 text-[#EAB308]" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
        <span>Premium Feature - Full analytics with bank connection</span>
      </div>

      {/* Income Settings Modal */}
      <IncomeSettingsModal
        userId={userId}
        isOpen={showIncomeModal}
        onClose={() => setShowIncomeModal(false)}
      />
    </div>
  );
}

// Income vs Spending Comparison component
function IncomeSpendingComparison({
  monthlyIncome,
  projectedSpending,
  hasIncome,
  onSetupIncome,
}: {
  monthlyIncome: number;
  projectedSpending: number;
  hasIncome: boolean;
  onSetupIncome: () => void;
}) {
  if (!hasIncome) {
    return (
      <button
        onClick={onSetupIncome}
        className="w-full p-6  bg-[#111820] border border-dashed border-[#424242] hover:border-[#22C55E] transition-all group"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12  bg-[#22C55E]/10 flex items-center justify-center group-hover:bg-[#22C55E]/20 transition-colors flex-shrink-0">
            <svg className="w-6 h-6 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-left flex-1">
            <h3 className="text-base font-semibold text-[white] mb-1">Add your income for deeper insights</h3>
            <p className="text-sm text-[#6B7280]">
              See how your spending trends compare to your income and track your savings rate over time.
            </p>
          </div>
          <svg className="w-5 h-5 text-[#6B7280] group-hover:text-[#22C55E] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>
    );
  }

  const projectedSavings = monthlyIncome - projectedSpending;
  const savingsRate = monthlyIncome > 0 ? (projectedSavings / monthlyIncome) * 100 : 0;
  const spendingRate = monthlyIncome > 0 ? (projectedSpending / monthlyIncome) * 100 : 0;

  const getStatus = () => {
    if (savingsRate >= 20) return { label: 'Excellent', color: '#22C55E', bgClass: 'bg-[#22C55E]/10' };
    if (savingsRate >= 10) return { label: 'Good', color: '#3B82F6', bgClass: 'bg-[#3B82F6]/10' };
    if (savingsRate >= 0) return { label: 'Thin margins', color: '#EAB308', bgClass: 'bg-[#EAB308]/10' };
    return { label: 'Over budget', color: '#EF4444', bgClass: 'bg-[#EF4444]/10' };
  };

  const status = getStatus();

  return (
    <div className="p-6  bg-[#111820] border border-[#424242]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-[white]">Income vs Projected Spending</h3>
        <button
          onClick={onSetupIncome}
          className="text-sm text-[#6B7280] hover:text-[white] transition-colors"
        >
          Edit income
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Visual comparison */}
        <div className="md:col-span-2 space-y-4">
          {/* Income */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[#9BA4B0]">Monthly Income</span>
              <span className="text-sm font-semibold text-[#22C55E]">{formatCurrency(monthlyIncome)}</span>
            </div>
            <div className="h-4 rounded-full bg-[#424242] overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#22C55E] to-[#16A34A] w-full" />
            </div>
          </div>

          {/* Projected Spending */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[#9BA4B0]">Projected Spending</span>
              <span className="text-sm font-semibold text-[white]">{formatCurrency(projectedSpending)}</span>
            </div>
            <div className="h-4 rounded-full bg-[#424242] overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  spendingRate > 100
                    ? 'bg-gradient-to-r from-[#EF4444] to-[#DC2626]'
                    : spendingRate > 80
                    ? 'bg-gradient-to-r from-[#EAB308] to-[#CA8A04]'
                    : 'bg-gradient-to-r from-[#3B82F6] to-[#2563EB]'
                }`}
                style={{ width: `${Math.min(spendingRate, 100)}%` }}
              />
            </div>
          </div>

          {/* Comparison message */}
          <div className={`mt-4 p-3  ${status.bgClass}`}>
            <p className="text-sm" style={{ color: status.color }}>
              {savingsRate >= 20
                ? `At this rate, you'll save ${formatCurrency(projectedSavings * 12)} this year. Keep it up.`
                : savingsRate >= 10
                ? `You're on track to save ${formatCurrency(projectedSavings * 12)} this year. Push for 20%.`
                : savingsRate >= 0
                ? `Thin margins - only ${formatCurrency(projectedSavings)} buffer. Cut the Red zone.`
                : `On pace to overspend by ${formatCurrency(Math.abs(projectedSavings * 12))} this year. Serious changes needed.`
              }
            </p>
          </div>
        </div>

        {/* Stats column */}
        <div className="space-y-4">
          <div className={`p-4  ${status.bgClass}`}>
            <p className="text-xs text-[#6B7280] mb-1">Projected Savings</p>
            <p className="text-2xl font-bold" style={{ color: status.color }}>
              {projectedSavings >= 0 ? formatCurrency(projectedSavings) : `-${formatCurrency(Math.abs(projectedSavings))}`}
            </p>
            <p className="text-xs mt-1" style={{ color: status.color }}>/month</p>
          </div>

          <div className={`p-4  ${status.bgClass}`}>
            <p className="text-xs text-[#6B7280] mb-1">Savings Rate</p>
            <p className="text-2xl font-bold" style={{ color: status.color }}>
              {Math.round(savingsRate)}%
            </p>
            <p className="text-xs mt-1" style={{ color: status.color }}>{status.label}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
