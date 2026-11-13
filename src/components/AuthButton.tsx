'use client';

import React, { useState } from 'react';
import { useCourses } from '@/context/CourseContext';
import { Cloud, CloudOff, Loader2, LogOut } from 'lucide-react';

interface AuthButtonProps {
  onOpenSettings?: () => void;
}

export const AuthButton: React.FC<AuthButtonProps> = ({ onOpenSettings }) => {
  const {
    user,
    authProvider,
    authLoading,
    firebaseConfigured,
    syncStatus,
    signInOneClick,
    signOut,
  } = useCourses();
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInOneClick();
    } catch (err: any) {
      alert(err?.message || 'Sign-in failed or was cancelled.');
    } finally {
      setSigningIn(false);
    }
  };

  if (authLoading) {
    return (
      <div className="h-8 px-3 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center gap-1.5 text-xs text-slate-500">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span className="hidden sm:inline">Auth...</span>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-sm">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'Student'}
            className="w-6 h-6 rounded-full object-cover"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
            {(user.displayName || user.email || 'U')[0].toUpperCase()}
          </div>
        )}

        <div className="hidden md:flex flex-col leading-tight pr-1">
          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 max-w-[100px] truncate">
            {user.displayName || user.email}
          </span>
          <span className="text-[9px] font-semibold flex items-center gap-1 text-slate-500 dark:text-slate-400">
            {syncStatus === 'syncing' && (
              <>
                <Loader2 className="w-2.5 h-2.5 animate-spin text-blue-500" /> Syncing
              </>
            )}
            {syncStatus === 'synced' && (
              <>
                <Cloud className="w-2.5 h-2.5 text-emerald-500" />
                {authProvider === 'firebase' ? 'Google Synced' : 'Cloud Synced'}
              </>
            )}
            {syncStatus === 'error' && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="inline-flex items-center gap-1 hover:underline cursor-pointer"
                title="Open Sync Settings"
              >
                <CloudOff className="w-2.5 h-2.5 text-rose-500" /> Sync Error
              </button>
            )}
            {syncStatus === 'local' && 'Local'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => signOut()}
          className="p-1 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
          title="Sign out"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSignIn}
      disabled={signingIn}
      className="bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2 px-3.5 rounded-full transition-all shadow-sm hover:shadow flex items-center gap-1.5 cursor-pointer"
      title={
        firebaseConfigured
          ? 'One-click Google Sign-In to sync progress, notes, and quiz scores across devices'
          : 'One-click Cloud Sign-In (Google, Apple, or email via Puter) — no setup needed'
      }
    >
      {signingIn ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
      ) : (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" aria-hidden="true">
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
      )}
      <span>Sign in</span>
    </button>
  );
};
