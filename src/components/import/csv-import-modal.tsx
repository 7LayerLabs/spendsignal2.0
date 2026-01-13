'use client';

import { useState, useCallback } from 'react';
import type { Transaction } from '@/types';
import { useDataMode } from '@/hooks/use-data-mode';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (transactions: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[]) => void;
}

interface ParsedRow {
  [key: string]: string;
}

interface ColumnMapping {
  date: string;
  amount: string;
  description: string;
  merchant: string;
}

// Common column name patterns for auto-detection
const COLUMN_PATTERNS = {
  date: ['date', 'transaction date', 'trans date', 'posted date', 'posting date', 'trans. date'],
  amount: ['amount', 'debit', 'credit', 'transaction amount', 'trans amount'],
  description: ['description', 'memo', 'details', 'transaction description', 'trans description', 'narrative'],
  merchant: ['merchant', 'payee', 'name', 'merchant name', 'vendor'],
};

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };

  // Parse headers
  const headers = parseCSVLine(lines[0]);

  // Parse rows
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const row: ParsedRow = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });
      rows.push(row);
    }
  }

  return { headers, rows };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());

  return result;
}

function autoDetectColumn(headers: string[], patterns: string[]): string {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  for (const pattern of patterns) {
    const idx = lowerHeaders.findIndex(h => h === pattern || h.includes(pattern));
    if (idx !== -1) return headers[idx];
  }
  return '';
}

function parseAmount(value: string): number {
  // Remove currency symbols, commas, and spaces
  let cleaned = value.replace(/[$£€,\s]/g, '');

  // Handle parentheses as negative (accounting format)
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1);
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseDate(value: string): Date {
  // Try common date formats
  const formats = [
    // MM/DD/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // YYYY-MM-DD
    /^(\d{4})-(\d{2})-(\d{2})$/,
    // DD/MM/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/,
  ];

  // Try native Date parsing first
  const native = new Date(value);
  if (!isNaN(native.getTime())) {
    return native;
  }

  // Default to today if parsing fails
  return new Date();
}

export function CSVImportModal({ isOpen, onClose, onImport }: CSVImportModalProps) {
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: '',
    amount: '',
    description: '',
    merchant: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { mode } = useDataMode();

  const processFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const { headers: parsedHeaders, rows: parsedRows } = parseCSV(text);

        if (parsedHeaders.length === 0) {
          setError('Could not parse CSV headers');
          return;
        }

        if (parsedRows.length === 0) {
          setError('No data rows found in CSV');
          return;
        }

        setHeaders(parsedHeaders);
        setRows(parsedRows);

        // Auto-detect column mappings
        setMapping({
          date: autoDetectColumn(parsedHeaders, COLUMN_PATTERNS.date),
          amount: autoDetectColumn(parsedHeaders, COLUMN_PATTERNS.amount),
          description: autoDetectColumn(parsedHeaders, COLUMN_PATTERNS.description),
          merchant: autoDetectColumn(parsedHeaders, COLUMN_PATTERNS.merchant),
        });

        setStep('map');
      } catch {
        setError('Failed to parse CSV file');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleImport = useCallback(async () => {
    if (!mapping.date || !mapping.amount) {
      setError('Date and Amount columns are required');
      return;
    }

    setImporting(true);
    setError(null);

    const transactions = rows.map((row) => {
      const amount = parseAmount(row[mapping.amount]);
      const description = mapping.description ? row[mapping.description] : '';
      const merchant = mapping.merchant ? row[mapping.merchant] : description.split(' ')[0];

      return {
        date: parseDate(row[mapping.date]).toISOString(),
        amount: Math.abs(amount),
        description: description || merchant,
        merchantName: merchant || description.split(' ').slice(0, 3).join(' '),
      };
    });

    // In real mode, save to database via API
    if (mode === 'real') {
      try {
        const response = await fetch('/api/transactions/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactions }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to import transactions');
          setImporting(false);
          return;
        }

        console.log('Imported to database:', data);
        // Reload page to see imported transactions
        window.location.reload();
      } catch (err) {
        console.error('Import error:', err);
        setError('Failed to import transactions. Please try again.');
        setImporting(false);
      }
    } else {
      // In demo mode, use localStorage via the onImport callback
      const demoTransactions: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[] = transactions.map((txn) => ({
        userId: 'demo-user',
        amount: txn.amount,
        description: txn.description,
        merchantName: txn.merchantName,
        date: new Date(txn.date),
        source: 'MANUAL' as const,
        externalId: null,
        defaultCategory: null,
        plaidConnectionId: null,
        pending: false,
        isRecurring: false,
      }));

      console.log('Importing to demo mode:', demoTransactions);
      onImport(demoTransactions);
      // Reload page to ensure all components get fresh data
      window.location.reload();
    }
  }, [rows, mapping, onImport, mode]);

  const handleClose = useCallback(() => {
    setStep('upload');
    setHeaders([]);
    setRows([]);
    setMapping({ date: '', amount: '', description: '', merchant: '' });
    setError(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-2xl mx-4 bg-[var(--background)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[var(--border)] bg-gradient-to-r from-[var(--card)] to-transparent">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[var(--foreground)]">Import Transactions</h2>
              <p className="text-sm text-[var(--foreground-subtle)] mt-1">
                {step === 'upload' && 'Upload a CSV file from your bank'}
                {step === 'map' && 'Map columns to transaction fields'}
                {step === 'preview' && 'Review before importing'}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg text-[var(--foreground-subtle)] hover:text-[var(--foreground)] hover:bg-[var(--hover)] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-sm">
              {error}
            </div>
          )}

          {step === 'upload' && (
            <div className="space-y-6">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  isDragging
                    ? 'border-[#3B82F6] bg-[#3B82F6]/10'
                    : 'border-[var(--border)] hover:border-[#3B82F6]/50'
                }`}
              >
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                    isDragging ? 'bg-[#3B82F6]/20' : 'bg-[#3B82F6]/10'
                  }`}>
                    <svg className="w-8 h-8 text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-[var(--foreground)] font-medium mb-1">
                    {isDragging ? 'Drop CSV file here' : 'Click to upload CSV'}
                  </p>
                  <p className="text-sm text-[var(--foreground-subtle)]">or drag and drop</p>
                </label>
              </div>

              <div className="p-4 rounded-lg bg-[var(--background-subtle)] border border-[var(--border)]">
                <h4 className="text-sm font-medium text-[var(--foreground)] mb-2">Supported formats</h4>
                <ul className="text-sm text-[var(--foreground-subtle)] space-y-1">
                  <li>Most bank CSV exports (Chase, Bank of America, Wells Fargo, etc.)</li>
                  <li>Credit card statement exports</li>
                  <li>Any CSV with date, amount, and description columns</li>
                </ul>
              </div>
            </div>
          )}

          {step === 'map' && (
            <div className="space-y-6">
              <p className="text-sm text-[var(--foreground-muted)]">
                Found {rows.length} transactions. Map your CSV columns to the fields below.
              </p>

              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                    Date Column <span className="text-[#EF4444]">*</span>
                  </label>
                  <select
                    value={mapping.date}
                    onChange={(e) => setMapping({ ...mapping, date: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-[var(--background-muted)] border border-[var(--border)] text-[var(--foreground)] focus:border-[#3B82F6] focus:outline-none"
                  >
                    <option value="">Select column...</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                    Amount Column <span className="text-[#EF4444]">*</span>
                  </label>
                  <select
                    value={mapping.amount}
                    onChange={(e) => setMapping({ ...mapping, amount: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-[var(--background-muted)] border border-[var(--border)] text-[var(--foreground)] focus:border-[#3B82F6] focus:outline-none"
                  >
                    <option value="">Select column...</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                    Description Column
                  </label>
                  <select
                    value={mapping.description}
                    onChange={(e) => setMapping({ ...mapping, description: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-[var(--background-muted)] border border-[var(--border)] text-[var(--foreground)] focus:border-[#3B82F6] focus:outline-none"
                  >
                    <option value="">Select column...</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                    Merchant Column
                  </label>
                  <select
                    value={mapping.merchant}
                    onChange={(e) => setMapping({ ...mapping, merchant: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-[var(--background-muted)] border border-[var(--border)] text-[var(--foreground)] focus:border-[#3B82F6] focus:outline-none"
                  >
                    <option value="">Select column...</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preview first few rows */}
              {mapping.date && mapping.amount && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-[var(--foreground)] mb-3">Preview (first 5 rows)</h4>
                  <div className="rounded-lg border border-[var(--border)] overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--background-subtle)]">
                        <tr>
                          <th className="px-4 py-2 text-left text-[var(--foreground-subtle)]">Date</th>
                          <th className="px-4 py-2 text-left text-[var(--foreground-subtle)]">Amount</th>
                          <th className="px-4 py-2 text-left text-[var(--foreground-subtle)]">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {rows.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="bg-[var(--card)]">
                            <td className="px-4 py-2 text-[var(--foreground)]">{row[mapping.date]}</td>
                            <td className="px-4 py-2 text-[var(--foreground)]">{row[mapping.amount]}</td>
                            <td className="px-4 py-2 text-[var(--foreground)] truncate max-w-[200px]">
                              {mapping.description ? row[mapping.description] : mapping.merchant ? row[mapping.merchant] : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center justify-between">
            <div>
              {step !== 'upload' && (
                <button
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  Back
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Cancel
              </button>
              {step === 'map' && (
                <button
                  onClick={handleImport}
                  disabled={!mapping.date || !mapping.amount || importing}
                  className="px-6 py-2 text-sm font-semibold text-white bg-[#22C55E] rounded-lg hover:bg-[#16A34A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {importing ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Importing...
                    </>
                  ) : (
                    <>
                      Import {rows.length} to {mode === 'real' ? 'Database' : 'Demo'}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
