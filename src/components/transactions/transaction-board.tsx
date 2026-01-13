'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { UncategorizedPool } from './uncategorized-pool';
import { TrafficLightZoneComponent } from './traffic-light-zone';
import { TransactionCardOverlay, MultiTransactionOverlay } from './transaction-card';
import { autoCategorize } from '@/lib/services/auto-categorize';
import type { Transaction, UserCategorization } from '@/types';
import type { TrafficLightZone } from '@/constants/traffic-light';

interface TransactionBoardProps {
  transactions: Transaction[];
  categorizations: UserCategorization[];
  onCategorize: (transactionId: string, zone: TrafficLightZone) => void;
}

export function TransactionBoard({
  transactions,
  categorizations,
  onCategorize,
}: TransactionBoardProps) {
  const [activeTransaction, setActiveTransaction] = useState<Transaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Configure sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Create a map of transaction ID to zone
  const categorizationMap = useMemo(() => {
    const map = new Map<string, TrafficLightZone>();
    categorizations.forEach((c) => {
      map.set(c.transactionId, c.zone);
    });
    return map;
  }, [categorizations]);

  // Group transactions by zone
  const groupedTransactions = useMemo(() => {
    const groups: Record<TrafficLightZone | 'UNCATEGORIZED', Transaction[]> = {
      UNCATEGORIZED: [],
      GREEN: [],
      YELLOW: [],
      RED: [],
    };

    transactions.forEach((transaction) => {
      const zone = categorizationMap.get(transaction.id) || 'UNCATEGORIZED';
      groups[zone].push(transaction);
    });

    return groups;
  }, [transactions, categorizationMap]);

  // Generate AI suggestions for uncategorized transactions using real categorization rules
  const aiSuggestions = useMemo(() => {
    const suggestions = new Map<string, { zone: TrafficLightZone; confidence: number; reasoning: string }>();

    groupedTransactions.UNCATEGORIZED.forEach((transaction) => {
      const result = autoCategorize(
        transaction.merchantName || '',
        transaction.description,
        Number(transaction.amount)
      );

      // autoCategorize always returns a result now
      suggestions.set(transaction.id, {
        zone: result.zone,
        confidence: result.confidence,
        reasoning: result.reasoning,
      });
    });

    return suggestions;
  }, [groupedTransactions.UNCATEGORIZED]);

  // Selection handlers
  const toggleSelection = useCallback((transactionId: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback((transactionIds: string[]) => {
    setSelectedIds(new Set(transactionIds));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Find transaction by ID
  const findTransaction = (id: string): Transaction | undefined => {
    return transactions.find((t) => t.id === id);
  };

  // Get selected transactions
  const getSelectedTransactions = useCallback((): Transaction[] => {
    return transactions.filter((t) => selectedIds.has(t.id));
  }, [transactions, selectedIds]);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const transaction = findTransaction(active.id as string);
    if (transaction) {
      setActiveTransaction(transaction);
      // If dragging a non-selected item, clear selection and just drag that one
      if (!selectedIds.has(transaction.id)) {
        clearSelection();
      }
    }
  };

  // Handle drag over (for live feedback)
  const handleDragOver = (event: DragOverEvent) => {
    // Could add visual feedback here if needed
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTransaction(null);

    if (!over) {
      return;
    }

    const draggedId = active.id as string;
    const overId = over.id as string;

    // Determine which transactions to categorize
    let transactionIds: string[];
    if (selectedIds.has(draggedId) && selectedIds.size > 1) {
      // Multi-select drag - categorize all selected
      transactionIds = Array.from(selectedIds);
    } else {
      // Single drag
      transactionIds = [draggedId];
    }

    // Determine target zone
    let targetZone: TrafficLightZone | null = null;

    if (overId === 'GREEN' || overId === 'YELLOW' || overId === 'RED') {
      targetZone = overId as TrafficLightZone;
    } else if (overId !== 'UNCATEGORIZED') {
      const overData = over.data.current;
      if (overData?.zone && overData.zone !== 'UNCATEGORIZED') {
        targetZone = overData.zone as TrafficLightZone;
      }
    }

    // Apply categorization
    if (targetZone) {
      transactionIds.forEach((id) => {
        const currentZone = categorizationMap.get(id);
        if (currentZone !== targetZone) {
          onCategorize(id, targetZone);
        }
      });
      // Clear selection after successful drop
      clearSelection();
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const total = transactions.length;
    const categorized = total - groupedTransactions.UNCATEGORIZED.length;
    const greenAmount = groupedTransactions.GREEN.reduce((sum, t) => sum + Number(t.amount), 0);
    const yellowAmount = groupedTransactions.YELLOW.reduce((sum, t) => sum + Number(t.amount), 0);
    const redAmount = groupedTransactions.RED.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalAmount = greenAmount + yellowAmount + redAmount;

    return {
      total,
      categorized,
      uncategorized: groupedTransactions.UNCATEGORIZED.length,
      greenAmount,
      yellowAmount,
      redAmount,
      totalAmount,
      greenPercent: totalAmount > 0 ? (greenAmount / totalAmount) * 100 : 0,
      yellowPercent: totalAmount > 0 ? (yellowAmount / totalAmount) * 100 : 0,
      redPercent: totalAmount > 0 ? (redAmount / totalAmount) * 100 : 0,
    };
  }, [transactions, groupedTransactions]);

  // Count selected from uncategorized
  const selectedCount = selectedIds.size;
  const selectedFromUncategorized = groupedTransactions.UNCATEGORIZED.filter(
    (t) => selectedIds.has(t.id)
  ).length;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {/* Simple progress indicator */}
      {stats.uncategorized > 0 && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#9BA4B0]">
              {stats.categorized} of {stats.total} categorized
            </span>
            {selectedCount > 0 && (
              <button
                onClick={clearSelection}
                className="text-xs text-[#FFC700] hover:underline"
              >
                {selectedCount} selected - Clear
              </button>
            )}
          </div>
          {/* Mini progress bar */}
          <div className="w-32 h-1.5 bg-[#424242] overflow-hidden">
            <div
              className="h-full bg-[#22C55E] transition-all duration-300"
              style={{ width: `${(stats.categorized / stats.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Main board layout - 4 columns on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Uncategorized / Inbox */}
        <UncategorizedPool
          transactions={groupedTransactions.UNCATEGORIZED}
          aiSuggestions={aiSuggestions}
          selectedIds={selectedIds}
          onToggleSelection={toggleSelection}
          onSelectAll={() => selectAll(groupedTransactions.UNCATEGORIZED.map((t) => t.id))}
          onClearSelection={clearSelection}
          onAutoCategorize={onCategorize}
        />

        {/* Green Zone */}
        <TrafficLightZoneComponent
          zone="GREEN"
          transactions={groupedTransactions.GREEN}
        />

        {/* Yellow Zone */}
        <TrafficLightZoneComponent
          zone="YELLOW"
          transactions={groupedTransactions.YELLOW}
        />

        {/* Red Zone */}
        <TrafficLightZoneComponent
          zone="RED"
          transactions={groupedTransactions.RED}
        />
      </div>

      {/* Drag overlay - shown while dragging */}
      <DragOverlay>
        {activeTransaction && (
          selectedIds.has(activeTransaction.id) && selectedIds.size > 1 ? (
            <MultiTransactionOverlay
              transaction={activeTransaction}
              count={selectedIds.size}
            />
          ) : (
            <TransactionCardOverlay transaction={activeTransaction} />
          )
        )}
      </DragOverlay>
    </DndContext>
  );
}

export { TransactionBoard as default };
