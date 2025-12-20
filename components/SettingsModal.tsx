import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);

  if (!isOpen) return null;

  const handleChange = (key: keyof AppSettings, value: any) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
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
          
          {/* General Config */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Pollinations API Key
            </label>
            <input
              type="password"
              value={localSettings.apiKey}
              onChange={(e) => handleChange('apiKey', e.target.value)}
              placeholder="Enter your API key (optional for public)"
              className="w-full bg-[#0b0b0c] border border-[#444746] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all"
            />
            <p className="text-xs text-gray-500 mt-2">
              Note: Models are now selected directly in the input bar settings based on the mode.
            </p>
          </div>

          {/* Endpoint Toggle */}
          <div className="pt-4 border-t border-[#444746]">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">Use Custom Text Endpoint</label>
              <button 
                onClick={() => handleChange('useCustomEndpoint', !localSettings.useCustomEndpoint)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${localSettings.useCustomEndpoint ? 'bg-blue-600' : 'bg-[#444746]'}`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${localSettings.useCustomEndpoint ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            
            {localSettings.useCustomEndpoint && (
              <input
                type="text"
                value={localSettings.customEndpoint}
                onChange={(e) => handleChange('customEndpoint', e.target.value)}
                placeholder="https://text.pollinations.ai/..."
                className="w-full bg-[#0b0b0c] border border-[#444746] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all mt-2"
              />
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