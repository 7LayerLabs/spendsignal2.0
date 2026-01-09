'use client';

import { useState, useEffect, useCallback } from 'react';
import type { TrafficLightZone } from '@/constants/traffic-light';

interface Transaction {
  id: string;
  userId: string;
  amount: number;
  description: string;
  merchantName: string | null;
  date: string;
  source: 'PLAID' | 'DEMO' | 'MANUAL';
  defaultCategory: string | null;
  pending: boolean;
  isRecurring: boolean;
  createdAt: string;
  updatedAt: string;
  zone: TrafficLightZone | null;
}

interface UseTransactionsResult {
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTransactions(days: number = 30): UseTransactionsResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/transactions?days=${days}`);

      if (!response.ok) {
        if (response.status === 401) {
          setError('Please log in to view transactions');
          setTransactions([]);
          return;
        }
        throw new Error('Failed to fetch transactions');
      }

      const data = await response.json();
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions,
    isLoading,
    error,
    refetch: fetchTransactions,
  };
}

// Hook for categorizations
interface Categorization {
  id: string;
  transactionId: string;
  zone: TrafficLightZone;
  note: string | null;
}

interface UseCategorizations {
  categorizations: Categorization[];
  isLoading: boolean;
  categorize: (transactionId: string, zone: TrafficLightZone, note?: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useCategorizations(): UseCategorizations {
  const [categorizations, setCategorizations] = useState<Categorization[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCategorizations = useCallback(async () => {
    try {
      const response = await fetch('/api/categorizations');
      if (response.ok) {
        const data = await response.json();
        setCategorizations(data.categorizations || []);
      }
    } catch (err) {
      console.error('Error fetching categorizations:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategorizations();
  }, [fetchCategorizations]);

  const categorize = useCallback(async (
    transactionId: string,
    zone: TrafficLightZone,
    note?: string
  ) => {
    try {
      const response = await fetch('/api/categorizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, zone, note }),
      });

      if (response.ok) {
        const data = await response.json();
        setCategorizations((prev) => {
          const existing = prev.findIndex((c) => c.transactionId === transactionId);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = data.categorization;
            return updated;
          }
          return [...prev, data.categorization];
        });
      }
    } catch (err) {
      console.error('Error saving categorization:', err);
    }
  }, []);

  return {
    categorizations,
    isLoading,
    categorize,
    refetch: fetchCategorizations,
  };
}

export { useTransactions as default };
