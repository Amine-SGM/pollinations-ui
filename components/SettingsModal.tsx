import React, { useState, useEffect } from 'react';
import { X, Save, Wallet, Loader2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AppSettings } from '../types';

// The developer's public env key — safe for client-side, used as fallback
const ENV_PUBLIC_KEY: string = (import.meta as any).env?.VITE_POLLINATIONS_API_KEY || '';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

interface AccountBalance {
  credits?: number;
  balance?: number;
  [key: string]: any;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [balance, setBalance] = useState<AccountBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // Sync local settings when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
      setBalance(null);
      setBalanceError(null);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleChange = (key: keyof AppSettings, value: any) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const fetchBalance = async () => {
    // Use user's key if set, otherwise fall back to the env public key
    const apiKey = localSettings.apiKey.trim() || ENV_PUBLIC_KEY;
    if (!apiKey) {
      setBalanceError('Please enter an API key first.');
      return;
    }
    setBalanceLoading(true);
    setBalanceError(null);
    setBalance(null);
    try {
      const res = await fetch('https://gen.pollinations.ai/account/balance', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Error ${res.status}: ${text || res.statusText}`);
      }
      const data = await res.json();
      setBalance(data);
    } catch (err: any) {
      setBalanceError(err.message || 'Failed to fetch balance.');
    } finally {
      setBalanceLoading(false);
    }
  };

  // Format balance value nicely
  const getBalanceDisplay = () => {
    if (!balance) return null;
    // Try common field names
    const val = balance.credits ?? balance.balance ?? balance.amount ?? balance.tokens;
    if (val !== undefined) return val;
    // Fallback: show first numeric value found
    const numericEntry = Object.entries(balance).find(([, v]) => typeof v === 'number');
    if (numericEntry) return `${numericEntry[0]}: ${numericEntry[1]}`;
    return JSON.stringify(balance);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1e1f20] w-full max-w-lg max-h-[90vh] rounded-2xl shadow-2xl border border-[#444746] flex flex-col animate-[fadeIn_0.2s_ease-out]">
        <div className="flex items-center justify-between p-6 border-b border-[#444746] flex-shrink-0">
          <h2 className="text-xl font-semibold text-white">Global Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">

          {/* API Key */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">
                Your API Key
              </label>
              {/* Status badge */}
              {!localSettings.apiKey.trim() && ENV_PUBLIC_KEY ? (
                <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                  <CheckCircle2 size={11} /> Using default public key
                </span>
              ) : localSettings.apiKey.trim() ? (
                <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">
                  <CheckCircle2 size={11} /> Custom key active
                </span>
              ) : null}
            </div>
            <input
              type="password"
              value={localSettings.apiKey}
              onChange={(e) => handleChange('apiKey', e.target.value)}
              placeholder={ENV_PUBLIC_KEY ? 'Override with your own key (optional)' : 'Enter your Pollinations API key'}
              className="w-full bg-[#0b0b0c] border border-[#444746] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all"
            />
            <p className="text-xs text-gray-500 mt-2">
              {ENV_PUBLIC_KEY
                ? 'A default public key is active. Enter your own key to override it and track your personal usage.'
                : 'Enter your Pollinations API key to use premium models and track usage.'}
            </p>
          </div>

          {/* Account Balance */}
          <div className="pt-4 border-t border-[#444746]">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Wallet size={16} />
                Account Balance
              </label>
              <button
                onClick={fetchBalance}
                disabled={balanceLoading}
                className="flex items-center gap-1.5 text-xs bg-[#2a2b2d] hover:bg-[#333537] border border-[#444746] text-gray-300 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {balanceLoading
                  ? <Loader2 size={13} className="animate-spin" />
                  : <RefreshCw size={13} />
                }
                {balanceLoading ? 'Checking...' : 'Check Balance'}
              </button>
            </div>

            {/* Balance Result */}
            {balanceError && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-300">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                {balanceError}
              </div>
            )}

            {balance !== null && !balanceError && (
              <div className="bg-[#0b0b0c] border border-[#444746] rounded-lg px-4 py-4 space-y-1">
                {(() => {
                  const entries = Object.entries(balance);
                  if (entries.length === 0) return <p className="text-sm text-gray-400">No balance data returned.</p>;
                  return entries.map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="text-sm font-semibold text-white">
                        {typeof val === 'number' ? val.toLocaleString() : String(val)}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            )}

            {balance === null && !balanceError && !balanceLoading && (
              <p className="text-xs text-gray-500">
                Click "Check Balance" to fetch your current account balance using the API key above.
              </p>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-[#444746] flex justify-end flex-shrink-0">
          <button
            onClick={() => {
              onSave(localSettings);
              onClose();
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-medium transition-colors"
          >
            <Save size={18} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};