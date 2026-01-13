'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useTransactions, useCategorizations } from '@/hooks/use-transactions';
import { useIncome } from '@/hooks/use-income';
import { formatCurrency, calculateHealthScore } from '@/lib/utils';
import { ZONE_CONFIG } from '@/constants/traffic-light';
import { IncomeSettingsModal } from '@/components/income/income-settings-modal';
import { useSession } from 'next-auth/react';
import { generateInsights } from '@/lib/services/spending-insights';

export default function DashboardPage() {
  const { data: session } = useSession();
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const { transactions: rawTransactions, isLoading } = useTransactions(30);
  const { categorizations: rawCategorizations } = useCategorizations();
  const userId = session?.user?.id || 'demo-user';
  const { calculations: incomeCalc, hasActiveIncome } = useIncome(userId);

  // Transform transactions and categorizations to expected format
  const transactions = useMemo(() =>
    rawTransactions.map(t => ({
      ...t,
      date: new Date(t.date),
      amount: t.amount,
    })), [rawTransactions]);

  const categorizations = useMemo(() =>
    rawCategorizations.map(c => ({
      transactionId: c.transactionId,
      zone: c.zone,
    })), [rawCategorizations]);

  // Generate spending insights
  const insights = useMemo(() => {
    if (transactions.length === 0) return [];
    return generateInsights(
      transactions.map(t => ({
        ...t,
        amount: Number(t.amount),
      })),
      categorizations,
      hasActiveIncome ? incomeCalc.monthlyIncome : undefined
    ).slice(0, 5); // Top 5 insights
  }, [transactions, categorizations, hasActiveIncome, incomeCalc.monthlyIncome]);

  // Calculate stats
  const stats = (() => {
    if (isLoading || transactions.length === 0) {
      return {
        totalTransactions: 0,
        categorized: 0,
        uncategorized: 0,
        greenAmount: 0,
        yellowAmount: 0,
        redAmount: 0,
        totalAmount: 0,
        healthScore: 100,
      };
    }

    const categorizationMap = new Map(categorizations.map((c) => [c.transactionId, c.zone]));

    let greenAmount = 0;
    let yellowAmount = 0;
    let redAmount = 0;
    let categorizedCount = 0;

    transactions.forEach((t) => {
      const zone = categorizationMap.get(t.id);
      const amount = Number(t.amount);

      if (zone === 'GREEN') {
        greenAmount += amount;
        categorizedCount++;
      } else if (zone === 'YELLOW') {
        yellowAmount += amount;
        categorizedCount++;
      } else if (zone === 'RED') {
        redAmount += amount;
        categorizedCount++;
      }
    });

    const totalAmount = greenAmount + yellowAmount + redAmount;
    const healthScore = calculateHealthScore(greenAmount, yellowAmount, redAmount);

    return {
      totalTransactions: transactions.length,
      categorized: categorizedCount,
      uncategorized: transactions.length - categorizedCount,
      greenAmount,
      yellowAmount,
      redAmount,
      totalAmount,
      healthScore,
    };
  })();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 rounded-full border-2 border-[#22C55E] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Simple welcome */}
      <div>
        <h1 className="text-xl font-semibold text-white">
          {getGreeting(stats.healthScore)}
        </h1>
        <p className="text-sm text-[#9BA4B0] mt-1">
          {stats.uncategorized > 0
            ? `${stats.uncategorized} transactions waiting to be categorized`
            : 'All caught up. Nice work.'}
        </p>
      </div>

      {/* Primary CTA - only if transactions need categorizing */}
      {stats.uncategorized > 0 && (
        <Link
          href="/dashboard/canvas"
          className="block p-5 bg-[#22C55E] text-white hover:bg-[#16A34A] transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Start Categorizing</p>
              <p className="text-sm text-white/80">{stats.uncategorized} transactions to review</p>
            </div>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      )}

      {/* Health Score + Zone Breakdown - combined */}
      <div className="p-6 bg-[#111820] border border-[#424242]">
        <div className="flex items-center gap-6 mb-6">
          {/* Score circle */}
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#424242"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={getHealthColor(stats.healthScore)}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(stats.healthScore / 100) * 251} 251`}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-2xl font-bold"
                style={{ color: getHealthColor(stats.healthScore) }}
              >
                {stats.healthScore}
              </span>
            </div>
          </div>
          <div>
            <p className="text-lg font-semibold text-white">Health Score</p>
            <p className="text-sm text-[#9BA4B0]">
              {getHealthMessage(stats.healthScore)}
            </p>
          </div>
        </div>

        {/* Zone bars */}
        {stats.totalAmount > 0 ? (
          <div className="space-y-3">
            <ZoneBar zone="GREEN" amount={stats.greenAmount} total={stats.totalAmount} />
            <ZoneBar zone="YELLOW" amount={stats.yellowAmount} total={stats.totalAmount} />
            <ZoneBar zone="RED" amount={stats.redAmount} total={stats.totalAmount} />
          </div>
        ) : (
          <p className="text-sm text-[#9BA4B0] text-center py-4">
            Categorize some transactions to see your breakdown
          </p>
        )}
      </div>

      {/* Income vs Spending */}
      <IncomeCard
        monthlyIncome={incomeCalc.monthlyIncome}
        monthlySpending={stats.totalAmount}
        hasIncome={hasActiveIncome}
        onSetupIncome={() => setShowIncomeModal(true)}
      />

      {/* Weekly Progress */}
      <WeeklyProgress
        transactions={transactions}
        categorizations={categorizations}
      />

      {/* Quick summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-[#111820] border border-[#424242] text-center">
          <p className="text-2xl font-bold text-white">{stats.totalTransactions}</p>
          <p className="text-xs text-[#9BA4B0]">Transactions</p>
        </div>
        <div className="p-4 bg-[#111820] border border-[#424242] text-center">
          <p className="text-2xl font-bold text-white">{formatCurrency(stats.totalAmount)}</p>
          <p className="text-xs text-[#9BA4B0]">Total Spending</p>
        </div>
        <div className="p-4 bg-[#111820] border border-[#424242] text-center">
          <p className="text-2xl font-bold text-[#EF4444]">{formatCurrency(stats.redAmount)}</p>
          <p className="text-xs text-[#9BA4B0]">Red Zone</p>
        </div>
      </div>

      {/* Spending Insights */}
      {insights.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-[#9BA4B0]">Insights</h3>
          {insights.map((insight, idx) => (
            <div
              key={idx}
              className={`p-4 border ${
                insight.type === 'warning'
                  ? 'bg-[#EF4444]/10 border-[#EF4444]/30'
                  : insight.type === 'win'
                  ? 'bg-[#22C55E]/10 border-[#22C55E]/30'
                  : insight.type === 'action'
                  ? 'bg-[#EAB308]/10 border-[#EAB308]/30'
                  : 'bg-[#111820] border-[#424242]'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${
                  insight.type === 'warning' ? 'text-[#EF4444]' :
                  insight.type === 'win' ? 'text-[#22C55E]' :
                  insight.type === 'action' ? 'text-[#EAB308]' :
                  'text-[#3B82F6]'
                }`}>
                  {insight.type === 'warning' && (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                  {insight.type === 'win' && (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {insight.type === 'action' && (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                  {insight.type === 'tip' && (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{insight.title}</p>
                  <p className="text-sm text-[#9BA4B0] mt-1">{insight.message}</p>
                  {insight.impact && (
                    <p className="text-xs text-[#6B7280] mt-2 italic">{insight.impact}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Income Settings Modal */}
      <IncomeSettingsModal
        userId="demo-user"
        isOpen={showIncomeModal}
        onClose={() => setShowIncomeModal(false)}
      />
    </div>
  );
}

// Zone progress bar
function ZoneBar({
  zone,
  amount,
  total,
}: {
  zone: 'GREEN' | 'YELLOW' | 'RED';
  amount: number;
  total: number;
}) {
  const config = ZONE_CONFIG[zone];
  const percent = total > 0 ? (amount / total) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="w-16 text-right">
        <span className="text-xs text-[#9BA4B0]">{config.label}</span>
      </div>
      <div className="flex-1 h-2 bg-[#424242] overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${percent}%`, backgroundColor: config.color }}
        />
      </div>
      <div className="w-20 text-right">
        <span className="text-sm font-medium text-white">{formatCurrency(amount)}</span>
      </div>
    </div>
  );
}

// Helpers
function getGreeting(healthScore: number): string {
  if (healthScore >= 80) return 'Looking good.';
  if (healthScore >= 60) return 'Room for improvement.';
  if (healthScore >= 40) return 'Your wallet is concerned.';
  return 'Time for tough love.';
}

function getHealthColor(score: number): string {
  if (score >= 70) return '#22C55E';
  if (score >= 40) return '#EAB308';
  return '#EF4444';
}

function getHealthMessage(score: number): string {
  if (score >= 80) return 'Strong financial discipline';
  if (score >= 60) return 'Good, but reduce Yellow/Red';
  if (score >= 40) return 'Too much discretionary spending';
  return 'Red zone needs attention';
}

function getTip(stats: { redAmount: number; yellowAmount: number; totalAmount: number }): string {
  if (stats.redAmount > stats.totalAmount * 0.2) {
    return `${Math.round((stats.redAmount / stats.totalAmount) * 100)}% Red zone. That money could be building your future.`;
  }
  if (stats.yellowAmount > stats.totalAmount * 0.4) {
    return 'Heavy Yellow spending. How many of those purchases will you remember next month?';
  }
  return 'Keep categorizing honestly. Self-awareness is the first step to financial freedom.';
}

// Income Card - simplified
function IncomeCard({
  monthlyIncome,
  monthlySpending,
  hasIncome,
  onSetupIncome,
}: {
  monthlyIncome: number;
  monthlySpending: number;
  hasIncome: boolean;
  onSetupIncome: () => void;
}) {
  if (!hasIncome) {
    return (
      <button
        onClick={onSetupIncome}
        className="w-full p-4 bg-[#111820] border border-dashed border-[#424242] hover:border-[#22C55E]/50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#22C55E]/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-left flex-1">
            <p className="text-sm font-medium text-white">Add your income</p>
            <p className="text-xs text-[#9BA4B0]">See savings rate and budget context</p>
          </div>
          <svg className="w-4 h-4 text-[#6B7280] group-hover:text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>
    );
  }

  const savings = monthlyIncome - monthlySpending;
  const savingsRate = monthlyIncome > 0 ? (savings / monthlyIncome) * 100 : 0;
  const spendingPercent = monthlyIncome > 0 ? Math.min((monthlySpending / monthlyIncome) * 100, 100) : 0;

  const getSavingsColor = () => {
    if (savingsRate >= 20) return '#22C55E';
    if (savingsRate >= 10) return '#FFC700';
    if (savingsRate >= 0) return '#EAB308';
    return '#EF4444';
  };

  return (
    <div className="p-5 bg-[#111820] border border-[#424242]">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-[#9BA4B0]">Income vs Spending</p>
        <button
          onClick={onSetupIncome}
          className="text-xs text-[#6B7280] hover:text-white"
        >
          Edit
        </button>
      </div>

      {/* Visual bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-[#9BA4B0] mb-1">
          <span>Spending</span>
          <span>{formatCurrency(monthlySpending)} of {formatCurrency(monthlyIncome)}</span>
        </div>
        <div className="h-3 bg-[#424242] overflow-hidden">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${spendingPercent}%`,
              backgroundColor: spendingPercent > 90 ? '#EF4444' : spendingPercent > 70 ? '#EAB308' : '#22C55E',
            }}
          />
        </div>
      </div>

      {/* Savings info */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[#9BA4B0]">
            {savings >= 0 ? 'Monthly savings' : 'Over budget'}
          </p>
          <p className="text-lg font-bold" style={{ color: getSavingsColor() }}>
            {savings >= 0 ? formatCurrency(savings) : `-${formatCurrency(Math.abs(savings))}`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#9BA4B0]">Savings rate</p>
          <p className="text-lg font-bold" style={{ color: getSavingsColor() }}>
            {Math.round(savingsRate)}%
          </p>
        </div>
      </div>
    </div>
  );
}

// Weekly Progress
function WeeklyProgress({
  transactions,
  categorizations,
}: {
  transactions: Array<{ id: string; date: Date; amount: number }>;
  categorizations: Array<{ transactionId: string; zone: string }>;
}) {
  // Get last 7 days of data
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (6 - i));
    return date;
  });

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Calculate daily spending by zone
  const dailyData = days.map((day) => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    const dayTransactions = transactions.filter((t) => {
      const tDate = new Date(t.date);
      return tDate >= dayStart && tDate <= dayEnd;
    });

    let green = 0, yellow = 0, red = 0;
    dayTransactions.forEach((t) => {
      const cat = categorizations.find((c) => c.transactionId === t.id);
      const amount = Number(t.amount);
      if (cat?.zone === 'GREEN') green += amount;
      else if (cat?.zone === 'YELLOW') yellow += amount;
      else if (cat?.zone === 'RED') red += amount;
    });

    return { date: day, green, yellow, red, total: green + yellow + red };
  });

  const maxTotal = Math.max(...dailyData.map((d) => d.total), 1);

  return (
    <div className="p-5 bg-[#111820] border border-[#424242]">
      <p className="text-sm font-medium text-[#9BA4B0] mb-4">This Week</p>

      <div className="flex items-end justify-between gap-2 h-24">
        {dailyData.map((day, i) => {
          const heightPercent = (day.total / maxTotal) * 100;
          const greenPercent = day.total > 0 ? (day.green / day.total) * 100 : 0;
          const yellowPercent = day.total > 0 ? (day.yellow / day.total) * 100 : 0;

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full overflow-hidden bg-[#424242] relative"
                style={{ height: `${Math.max(heightPercent, 4)}%` }}
              >
                {day.total > 0 && (
                  <>
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-[#22C55E]"
                      style={{ height: `${greenPercent}%` }}
                    />
                    <div
                      className="absolute left-0 right-0 bg-[#EAB308]"
                      style={{ height: `${yellowPercent}%`, bottom: `${greenPercent}%` }}
                    />
                    <div
                      className="absolute top-0 left-0 right-0 bg-[#EF4444]"
                      style={{ height: `${100 - greenPercent - yellowPercent}%` }}
                    />
                  </>
                )}
              </div>
              <span className="text-xs text-[#6B7280]">
                {dayLabels[day.date.getDay()]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Week total */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#424242]">
        <span className="text-xs text-[#9BA4B0]">Week total</span>
        <span className="text-sm font-medium text-white">
          {formatCurrency(dailyData.reduce((sum, d) => sum + d.total, 0))}
        </span>
      </div>
    </div>
  );
}
