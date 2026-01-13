'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useUserSettings, useUserProfile } from '@/hooks/use-user-settings';
import { useIncome } from '@/hooks/use-income';
import { useDemoTransactions } from '@/hooks/use-demo-transactions';
import { useTheme } from '@/components/theme-provider';
import { useDataMode } from '@/hooks/use-data-mode';
import { formatCurrency } from '@/lib/utils';
import { IncomeSettingsModal } from '@/components/income/income-settings-modal';
import { CSVImportModal } from '@/components/import/csv-import-modal';
import { PDFImportModal } from '@/components/import/pdf-import-modal';

export default function SettingsPage() {
  const { settings, isLoading, updateSetting } = useUserSettings('demo-user');
  const { profile } = useUserProfile('demo-user');
  const { calculations: incomeCalc, hasActiveIncome } = useIncome('demo-user');
  const { importTransactions, transactions } = useDemoTransactions('demo-user');
  const { theme, setTheme } = useTheme();
  const { mode } = useDataMode();
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPDFImportModal, setShowPDFImportModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-[#FFC700] border-t-transparent animate-spin" />
          <p className="text-[#9BA4B0]">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[white]">Settings</h1>
        <p className="text-sm text-[#9BA4B0] mt-1">
          Manage your account preferences and configurations
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          href="/dashboard/settings/profile"
          className="p-4 rounded bg-[#111820] border border-[#424242] hover:border-[#FFC700]/50 transition-all group"
        >
          <div className="w-10 h-10 rounded bg-[#FFC700]/10 flex items-center justify-center mb-3 group-hover:bg-[#FFC700]/20 transition-colors">
            <svg className="w-5 h-5 text-[#FFC700]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-[white]">Profile</h3>
          <p className="text-xs text-[#6B7280] mt-0.5">Manage your account</p>
        </Link>

        <Link
          href="/dashboard/settings/billing"
          className="p-4 rounded bg-[#111820] border border-[#424242] hover:border-[#FFC700]/50 transition-all group"
        >
          <div className="w-10 h-10 rounded bg-[#22C55E]/10 flex items-center justify-center mb-3 group-hover:bg-[#22C55E]/20 transition-colors">
            <svg className="w-5 h-5 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-[white]">Billing</h3>
          <p className="text-xs text-[#6B7280] mt-0.5">Subscription & payments</p>
        </Link>

        <Link
          href="/dashboard/settings/connections"
          className="p-4 rounded bg-[#111820] border border-[#424242] hover:border-[#FFC700]/50 transition-all group"
        >
          <div className="w-10 h-10 rounded bg-[#FFC700]/10 flex items-center justify-center mb-3 group-hover:bg-[#FFC700]/20 transition-colors">
            <svg className="w-5 h-5 text-[#FFC700]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-[white]">Connections</h3>
          <p className="text-xs text-[#6B7280] mt-0.5">Bank accounts</p>
        </Link>

        <button
          onClick={() => setShowIncomeModal(true)}
          className="p-4 rounded bg-[#111820] border border-[#424242] hover:border-[#FFC700]/50 transition-all group text-left"
        >
          <div className="w-10 h-10 rounded bg-[#EAB308]/10 flex items-center justify-center mb-3 group-hover:bg-[#EAB308]/20 transition-colors">
            <svg className="w-5 h-5 text-[#EAB308]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-[white]">Income</h3>
          <p className="text-xs text-[#6B7280] mt-0.5">
            {hasActiveIncome ? formatCurrency(incomeCalc.monthlyIncome) + '/mo' : 'Not configured'}
          </p>
        </button>
      </div>

      {/* Display Settings */}
      <div className="p-6 rounded bg-[#111820] border border-[#424242]">
        <h2 className="text-lg font-semibold text-[white] mb-6">Display Preferences</h2>

        <div className="space-y-6">
          {/* Theme */}
          <SettingRow
            label="Theme"
            description="Choose your preferred color scheme"
          >
            <div className="flex gap-2">
              {(['dark', 'light', 'system'] as const).map((themeOption) => (
                <button
                  key={themeOption}
                  onClick={() => setTheme(themeOption)}
                  className={`px-4 py-2 rounded text-sm font-medium transition-all ${
                    theme === themeOption
                      ? 'bg-[#FFC700] text-white'
                      : 'bg-[#0D1117] text-[#9BA4B0] hover:text-[white]'
                  }`}
                >
                  {themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}
                </button>
              ))}
            </div>
          </SettingRow>

          {/* Currency */}
          <SettingRow
            label="Currency"
            description="Display currency for amounts"
          >
            <select
              value={settings.currency}
              onChange={(e) => updateSetting('currency', e.target.value)}
              className="px-4 py-2 rounded bg-[#0D1117] border border-[#424242] text-[white] text-sm focus:border-[#FFC700] focus:outline-none"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="CAD">CAD ($)</option>
              <option value="AUD">AUD ($)</option>
            </select>
          </SettingRow>

          {/* Date Format */}
          <SettingRow
            label="Date Format"
            description="How dates are displayed"
          >
            <select
              value={settings.dateFormat}
              onChange={(e) => updateSetting('dateFormat', e.target.value as typeof settings.dateFormat)}
              className="px-4 py-2 rounded bg-[#0D1117] border border-[#424242] text-[white] text-sm focus:border-[#FFC700] focus:outline-none"
            >
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </SettingRow>

          {/* Show amounts */}
          <SettingRow
            label="Show Amounts"
            description="Display monetary values on dashboard"
          >
            <ToggleSwitch
              enabled={settings.showAmountsOnDashboard}
              onToggle={() => updateSetting('showAmountsOnDashboard', !settings.showAmountsOnDashboard)}
            />
          </SettingRow>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="p-6 rounded bg-[#111820] border border-[#424242]">
        <h2 className="text-lg font-semibold text-[white] mb-6">Notifications</h2>

        <div className="space-y-6">
          <SettingRow
            label="Email Notifications"
            description="Receive alerts and updates via email"
          >
            <ToggleSwitch
              enabled={settings.emailNotifications}
              onToggle={() => updateSetting('emailNotifications', !settings.emailNotifications)}
            />
          </SettingRow>

          <SettingRow
            label="Push Notifications"
            description="Browser push notifications for alerts"
          >
            <ToggleSwitch
              enabled={settings.pushNotifications}
              onToggle={() => updateSetting('pushNotifications', !settings.pushNotifications)}
            />
          </SettingRow>

          <SettingRow
            label="Weekly Digest"
            description="Receive a weekly spending summary"
          >
            <ToggleSwitch
              enabled={settings.weeklyDigest}
              onToggle={() => updateSetting('weeklyDigest', !settings.weeklyDigest)}
            />
          </SettingRow>
        </div>
      </div>

      {/* Data Settings */}
      <div className="p-6 rounded bg-[#111820] border border-[#424242]">
        <h2 className="text-lg font-semibold text-[white] mb-6">Data & Privacy</h2>

        <div className="space-y-6">
          <SettingRow
            label="Default Time Period"
            description="Default range for transaction views"
          >
            <select
              value={settings.defaultTransactionDays}
              onChange={(e) => updateSetting('defaultTransactionDays', parseInt(e.target.value))}
              className="px-4 py-2 rounded bg-[#0D1117] border border-[#424242] text-[white] text-sm focus:border-[#FFC700] focus:outline-none"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </SettingRow>

          {/* Import Data */}
          <SettingRow
            label="Import Transactions"
            description="Import from CSV or PDF bank statements"
          >
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#6B7280]">
                {transactions.length} transactions
              </span>
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-2 rounded bg-[#22C55E]/10 text-[#22C55E] text-sm font-medium hover:bg-[#22C55E]/20 transition-colors"
              >
                CSV
              </button>
              <button
                onClick={() => setShowPDFImportModal(true)}
                className="px-4 py-2 rounded bg-[#EF4444]/10 text-[#EF4444] text-sm font-medium hover:bg-[#EF4444]/20 transition-colors"
              >
                PDF
              </button>
            </div>
          </SettingRow>

          {/* Export Data */}
          <SettingRow
            label="Export Data"
            description="Download all your data as JSON"
          >
            <button className="px-4 py-2 rounded bg-[#0D1117] text-[#9BA4B0] text-sm font-medium hover:text-[white] transition-colors">
              Export
            </button>
          </SettingRow>

          {/* Clear Data */}
          <SettingRow
            label={mode === 'real' ? 'Clear All Data' : 'Clear Demo Data'}
            description={mode === 'real'
              ? 'Delete all transactions and categorizations from database'
              : 'Reset all demo transactions and categorizations'
            }
          >
            <button
              onClick={async () => {
                const message = mode === 'real'
                  ? 'Are you sure? This will permanently delete all your transactions from the database.'
                  : 'Are you sure? This will clear all your demo data.';

                if (confirm(message)) {
                  setIsClearing(true);

                  // Save the current data mode before clearing
                  const currentDataMode = localStorage.getItem('spendsignal-data-mode');

                  // Clear localStorage (except data mode)
                  const keys = Object.keys(localStorage).filter(k =>
                    (k.startsWith('spendsignal-') || k.startsWith('spendsignal_')) &&
                    k !== 'spendsignal-data-mode'
                  );
                  keys.forEach(k => localStorage.removeItem(k));
                  localStorage.setItem('spendsignal-data-cleared-demo-user', 'true');

                  // Restore data mode setting
                  if (currentDataMode) {
                    localStorage.setItem('spendsignal-data-mode', currentDataMode);
                  }

                  // If in real mode, also clear database
                  if (mode === 'real') {
                    try {
                      const response = await fetch('/api/transactions', {
                        method: 'DELETE',
                      });
                      if (!response.ok) {
                        console.error('Failed to clear database');
                      }
                    } catch (err) {
                      console.error('Error clearing database:', err);
                    }
                  }

                  window.location.reload();
                }
              }}
              disabled={isClearing}
              className="px-4 py-2 rounded bg-[#EF4444]/10 text-[#EF4444] text-sm font-medium hover:bg-[#EF4444]/20 transition-colors disabled:opacity-50"
            >
              {isClearing ? 'Clearing...' : 'Clear Data'}
            </button>
          </SettingRow>
        </div>
      </div>

      {/* Account Actions */}
      <div className="p-6 rounded bg-[#111820] border border-[#424242]">
        <h2 className="text-lg font-semibold text-[white] mb-6">Account</h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded bg-[#0D1117] border border-[#424242]">
            <div>
              <p className="text-sm font-medium text-[white]">Account Status</p>
              <p className="text-xs text-[#6B7280] mt-0.5">Demo Mode</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#FFC700]/20 text-[#FFC700]">
              Free Tier
            </span>
          </div>

          <div className="flex items-center justify-between p-4 rounded bg-[#0D1117] border border-[#424242]">
            <div>
              <p className="text-sm font-medium text-[white]">Member Since</p>
              <p className="text-xs text-[#6B7280] mt-0.5">{profile.createdAt.toLocaleDateString()}</p>
            </div>
          </div>

          <Link
            href="/dashboard/settings/billing"
            className="flex items-center justify-between p-4 rounded bg-gradient-to-r from-[#22C55E]/10 to-[#FFC700]/10 border border-[#22C55E]/20 hover:border-[#22C55E]/40 transition-colors"
          >
            <div>
              <p className="text-sm font-medium text-[white]">Upgrade to Premium</p>
              <p className="text-xs text-[#6B7280] mt-0.5">Unlock all features and bank connections</p>
            </div>
            <svg className="w-5 h-5 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Income Modal */}
      <IncomeSettingsModal
        userId="demo-user"
        isOpen={showIncomeModal}
        onClose={() => setShowIncomeModal(false)}
      />

      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={importTransactions}
      />

      {/* PDF Import Modal */}
      <PDFImportModal
        isOpen={showPDFImportModal}
        onClose={() => setShowPDFImportModal(false)}
        onImport={importTransactions}
      />
    </div>
  );
}

// Setting Row Component
function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium text-[white]">{label}</p>
        <p className="text-xs text-[#6B7280] mt-0.5">{description}</p>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

// Toggle Switch Component
function ToggleSwitch({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-12 h-6 rounded-full transition-colors ${
        enabled ? 'bg-[#22C55E]' : 'bg-[#0D1117]'
      }`}
    >
      <div
        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
          enabled ? 'left-7' : 'left-1'
        }`}
      />
    </button>
  );
}
