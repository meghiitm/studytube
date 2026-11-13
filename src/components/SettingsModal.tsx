'use client';

import React, { useState, useEffect } from 'react';
import { useCourses } from '@/context/CourseContext';
import { Settings, Key, Download, Upload, Check, X, Cloud, Trash2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    apiKey,
    setApiKey,
    courses,
    progress,
    stats,
    roadmaps,
    importFullBackup,
    firebaseConfigured,
    firebaseConfigSource,
    firebaseConfigText,
    saveFirebaseConfig,
    clearFirebaseConfig,
    user,
    syncStatus,
    syncError,
    loginWithGoogle,
    logout,
  } = useCourses();

  const [tempKey, setTempKey] = useState(apiKey);
  const [tempFbConfig, setTempFbConfig] = useState(firebaseConfigText);
  const [fbError, setFbError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTempKey(apiKey);
      setTempFbConfig(firebaseConfigText);
      setFbError(null);
    }
  }, [isOpen, apiKey, firebaseConfigText]);

  if (!isOpen) return null;

  const handleSave = () => {
    setApiKey(tempKey.trim());

    if (firebaseConfigSource !== 'env') {
      const trimmedFb = tempFbConfig.trim();
      if (trimmedFb) {
        const ok = saveFirebaseConfig(trimmedFb);
        if (!ok) {
          setFbError(
            'Invalid Firebase config. Paste the firebaseConfig JSON/object containing apiKey, authDomain, projectId, and appId.'
          );
          return;
        }
      } else if (firebaseConfigSource === 'local') {
        clearFirebaseConfig();
      }
    }

    setFbError(null);
    setSavedMessage(true);
    setTimeout(() => {
      setSavedMessage(false);
      onClose();
    }, 800);
  };

  const handleExportData = () => {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      courses,
      progress,
      stats,
      roadmaps,
    };
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `studytube-backup-${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          importFullBackup({ courses: parsed });
          alert('Courses imported successfully!');
        } else if (parsed && typeof parsed === 'object') {
          importFullBackup(parsed);
          alert('Courses & progress imported successfully!');
        }
      } catch {
        alert('Invalid JSON file format');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="relative w-full max-w-xl max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-800 dark:text-slate-100">
        <div className="p-6 pb-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Platform Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Google Auth & Firestore Cloud Sync */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  Google Sign-In & Cloud Sync
                </h3>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  firebaseConfigured
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                }`}
              >
                {firebaseConfigured
                  ? firebaseConfigSource === 'env'
                    ? 'Configured (.env)'
                    : 'Configured (Manual)'
                  : 'Requires Firebase Config'}
              </span>
            </div>

            {user ? (
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    Signed in as {user.displayName || user.email}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Account: <strong>Google</strong> &bull; Status: <strong>{syncStatus}</strong>
                    {syncError ? ` (${syncError})` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 text-xs font-semibold cursor-pointer shrink-0"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await loginWithGoogle();
                  } catch (e: any) {
                    setFbError(e?.message || 'Google sign-in failed.');
                  }
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            )}

            {firebaseConfigSource !== 'env' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Paste Firebase Web Config (or set <code>NEXT_PUBLIC_FIREBASE_*</code> in <code>.env.local</code>):
                  </label>
                  {firebaseConfigSource === 'local' && (
                    <button
                      type="button"
                      onClick={() => {
                        clearFirebaseConfig();
                        setTempFbConfig('');
                      }}
                      className="text-[11px] text-rose-500 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Clear
                    </button>
                  )}
                </div>
                <textarea
                  rows={4}
                  value={tempFbConfig}
                  onChange={(e) => setTempFbConfig(e.target.value)}
                  placeholder={`{\n  "apiKey": "...",\n  "authDomain": "your-app.firebaseapp.com",\n  "projectId": "your-app",\n  "appId": "1:..."\n}`}
                  className="w-full p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-[11px] font-mono text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Enable <strong>Authentication → Google</strong> and <strong>Cloud Firestore</strong> in Firebase Console. Recommended Firestore rule: <code>match /users/{'{uid}'} {'{ allow read, write: if request.auth != null && request.auth.uid == uid; }'}</code>
                </p>
              </div>
            )}

            {fbError && <p className="text-xs text-rose-600 dark:text-rose-400">{fbError}</p>}
          </div>

          {/* Gemini API Key */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-500" />
                Google Gemini API Key (Optional)
              </span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
              >
                Get API Key &rarr;
              </a>
            </label>
            <input
              type="password"
              value={tempKey}
              onChange={(e) => setTempKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Stored locally in your browser. Optional — transcripts, notes, flashcards, daily planner, and AI summaries all work without an API key.
            </p>
          </div>

          {/* Backup & Restore */}
          <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Backup Courses, Notes, Progress & Streaks
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleExportData}
                className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                Export All (JSON)
              </button>

              <label className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                Import Backup
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportData}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white rounded-full text-xs font-bold shadow-md transition cursor-pointer"
          >
            {savedMessage && <Check className="w-3.5 h-3.5" />}
            {savedMessage ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};
