'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { formatCurrency, formatRelativeDate } from '@/lib/utils';
import type { Transaction } from '@/types';
import type { TrafficLightZone } from '@/constants/traffic-light';

interface TransactionCardProps {
  transaction: Transaction;
  aiSuggestion?: {
    zone: TrafficLightZone;
    confidence: number;
    reasoning: string;
  };
  isOverlay?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
  selectionMode?: boolean;
}

export function TransactionCard({
  transaction,
  aiSuggestion,
  isOverlay = false,
  isSelected = false,
  onToggleSelection,
  selectionMode = false,
}: TransactionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: transaction.id,
    data: {
      type: 'transaction',
      transaction,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const zoneColors: Record<TrafficLightZone, { bg: string; border: string; text: string; glow: string }> = {
    GREEN: {
      bg: 'bg-[#22C55E]/10',
      border: 'border-[#22C55E]/30',
      text: 'text-[#22C55E]',
      glow: 'shadow-[0_0_12px_rgba(34,197,94,0.3)]',
    },
    YELLOW: {
      bg: 'bg-[#EAB308]/10',
      border: 'border-[#EAB308]/30',
      text: 'text-[#EAB308]',
      glow: 'shadow-[0_0_12px_rgba(234,179,8,0.3)]',
    },
    RED: {
      bg: 'bg-[#EF4444]/10',
      border: 'border-[#EF4444]/30',
      text: 'text-[#EF4444]',
      glow: 'shadow-[0_0_12px_rgba(239,68,68,0.3)]',
    },
    UNCATEGORIZED: {
      bg: 'bg-[#3B82F6]/10',
      border: 'border-[#3B82F6]/30',
      text: 'text-[#3B82F6]',
      glow: '',
    },
  };

  const suggestionStyle = aiSuggestion ? zoneColors[aiSuggestion.zone] : null;

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onToggleSelection?.(transaction.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        group relative p-4 rounded-xl border cursor-grab active:cursor-grabbing
        transition-all duration-200
        ${isSelected
          ? 'bg-[#22C55E]/10 border-[#22C55E] ring-2 ring-[#22C55E]/30'
          : 'bg-[var(--card)] border-[var(--border)] hover:border-[#3B82F6]/50'
        }
        ${isDragging ? 'opacity-50 scale-105 rotate-2 z-50' : ''}
        ${isOverlay ? 'shadow-2xl rotate-3 scale-105' : ''}
      `}
    >
      {/* Selection checkbox - always visible */}
      <button
        onClick={handleCheckboxClick}
        onPointerDown={(e) => e.stopPropagation()}
        className={`
          absolute top-3 left-3 w-5 h-5 rounded border-2 flex items-center justify-center
          transition-all duration-150 z-10
          ${isSelected
            ? 'bg-[#22C55E] border-[#22C55E]'
            : 'bg-transparent border-[#424242] hover:border-[#22C55E]'
          }
        `}
      >
        {isSelected && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Drag handle indicator */}
      <div className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity ${selectionMode || isSelected ? 'right-2' : ''}`}>
        <svg className="w-4 h-4 text-[var(--foreground-subtle)]" fill="currentColor" viewBox="0 0 16 16">
          <path d="M3 4.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm4 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm4 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM3 8.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm4 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm4 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z"/>
        </svg>
      </div>

      {/* Main content - always has left margin for checkbox */}
      <div className="flex items-start justify-between gap-3 ml-7">
        <div className="flex-1 min-w-0">
          <p className="text-base font-medium text-[var(--foreground)] truncate">
            {transaction.merchantName || 'Unknown Merchant'}
          </p>
          <p className="text-sm text-[var(--foreground-subtle)] truncate mt-0.5">
            {transaction.defaultCategory || transaction.description}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-base font-semibold text-[var(--foreground)]">
            {formatCurrency(Number(transaction.amount))}
          </p>
          <p className="text-sm text-[var(--foreground-subtle)] mt-0.5">
            {formatRelativeDate(new Date(transaction.date))}
          </p>
        </div>
      </div>

      {/* AI Suggestion Badge */}
      {aiSuggestion && suggestionStyle && (
        <div className={`mt-3 p-3 rounded-lg ${suggestionStyle.bg} border ${suggestionStyle.border} ml-7`}>
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2.5 h-2.5 rounded-full ${suggestionStyle.text.replace('text-', 'bg-')}`} />
            <span className={`text-sm font-medium ${suggestionStyle.text}`}>
              AI suggests {aiSuggestion.zone}
            </span>
            <span className="text-sm text-[var(--foreground-subtle)]">
              {Math.round(aiSuggestion.confidence * 100)}%
            </span>
          </div>
          <p className="text-sm text-[var(--foreground-muted)] italic leading-relaxed">
            &quot;{aiSuggestion.reasoning}&quot;
          </p>
        </div>
      )}

      {/* Recurring indicator */}
      {transaction.isRecurring && (
        <div className="absolute -top-2 left-5 w-5 h-5 rounded-full bg-[#3B82F6] flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
      )}

      {/* Pending indicator */}
      {transaction.pending && (
        <div className="absolute top-2 left-10">
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#EAB308]/20 text-[#EAB308]">
            Pending
          </span>
        </div>
      )}
    </div>
  );
}

// Simplified card for drag overlay
export function TransactionCardOverlay({ transaction }: { transaction: Transaction }) {
  return (
    <div className="p-4 rounded-xl border bg-[var(--card)] border-[#3B82F6] shadow-2xl rotate-3 scale-105">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-base font-medium text-[var(--foreground)] truncate">
            {transaction.merchantName || 'Unknown Merchant'}
          </p>
          <p className="text-sm text-[var(--foreground-subtle)] truncate mt-0.5">
            {transaction.defaultCategory || transaction.description}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-base font-semibold text-[var(--foreground)]">
            {formatCurrency(Number(transaction.amount))}
          </p>
        </div>
      </div>
    </div>
  );
}

// Multi-transaction overlay for dragging multiple items
export function MultiTransactionOverlay({
  transaction,
  count,
}: {
  transaction: Transaction;
  count: number;
}) {
  return (
    <div className="relative">
      {/* Stacked cards effect */}
      <div className="absolute top-2 left-2 w-full h-full p-4 rounded-xl border bg-[var(--card)] border-[#22C55E]/50 opacity-60" />
      <div className="absolute top-1 left-1 w-full h-full p-4 rounded-xl border bg-[var(--card)] border-[#22C55E]/70 opacity-80" />

      {/* Main card */}
      <div className="relative p-4 rounded-xl border bg-[var(--card)] border-[#22C55E] shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-base font-medium text-[var(--foreground)] truncate">
              {transaction.merchantName || 'Unknown Merchant'}
            </p>
            <p className="text-sm text-[var(--foreground-subtle)] truncate mt-0.5">
              {transaction.defaultCategory || transaction.description}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-base font-semibold text-[var(--foreground)]">
              {formatCurrency(Number(transaction.amount))}
            </p>
          </div>
        </div>

        {/* Count badge */}
        <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-[#22C55E] flex items-center justify-center shadow-lg">
          <span className="text-sm font-bold text-white">{count}</span>
        </div>
      </div>
    </div>
  );
}

export { TransactionCard as default };
