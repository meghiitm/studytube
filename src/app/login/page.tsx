'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCourses } from '@/context/CourseContext';
import { initGoogleOneTap, isMobileBrowser } from '@/lib/auth';
import { ArrowLeft, Loader2, Sparkles, CheckCircle2, ShieldCheck, LogOut } from 'lucide-react';
import Link from 'next/link';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/';

  const {
    user,
    authLoading,
    firebaseConfigured,
    loginWithGoogle,
    logout,
  } = useCourses();

  const [signingIn, setSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If already logged in, redirect automatically to the returnUrl
  useEffect(() => {
    if (!authLoading && user) {
      router.replace(returnUrl);
    }
  }, [user, authLoading, returnUrl, router]);

  // Initialize Google One Tap with FedCM enabled
  useEffect(() => {
    if (user || authLoading) return;
    const cleanup = initGoogleOneTap(() => {
      router.replace(returnUrl);
    });
    return cleanup;
  }, [user, authLoading, returnUrl, router]);

  const handleContinueWithGoogle = async () => {
    setSigningIn(true);
    setErrorMessage(null);

    try {
      const loggedInUser = await loginWithGoogle();
      // On desktop popup, loggedInUser is returned; on mobile redirect, page unloads/navigates
      if (loggedInUser) {
        router.replace(returnUrl);
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Failed to sign in with Google. Please try again.'
      );
    } finally {
      setSigningIn(false);
    }
  };

  // Loading skeleton while initial auth state resolves (prevents flash for logged-in users)
  if (authLoading) {
    return (
      <div className="w-full max-w-md p-8 sm:p-10 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl shadow-xl space-y-6 animate-pulse">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-800" />
          <div className="w-48 h-6 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="w-64 h-4 rounded-full bg-slate-100 dark:bg-slate-800/60" />
        </div>
        <div className="w-full h-13 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="space-y-2 pt-2">
          <div className="w-full h-3 rounded bg-slate-100 dark:bg-slate-800/50" />
          <div className="w-5/6 mx-auto h-3 rounded bg-slate-100 dark:bg-slate-800/50" />
        </div>
      </div>
    );
  }

  // Already logged in view
  if (user) {
    return (
      <div className="w-full max-w-md p-8 sm:p-10 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl shadow-xl space-y-6 text-center">
        <div className="flex flex-col items-center space-y-3">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'Google Profile'}
              className="w-16 h-16 rounded-full object-cover ring-4 ring-blue-50 dark:ring-blue-900/40"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-blue-600 text-white text-xl font-bold flex items-center justify-center">
              {user.firstName[0]?.toUpperCase() || 'U'}
            </div>
          )}
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Welcome back, {user.firstName}!
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Signed in as {user.email}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-3 text-left">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-xs text-emerald-800 dark:text-emerald-200">
            Your progress, notes, and quiz scores are synced to your Google account.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link
            href={returnUrl}
            className="flex-1 py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm transition shadow-md"
          >
            Continue Learning
          </Link>
          <button
            type="button"
            onClick={() => logout()}
            className="py-3 px-4 rounded-2xl bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/40 text-slate-700 hover:text-rose-600 dark:text-slate-200 dark:hover:text-rose-400 font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md p-7 sm:p-9 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl shadow-2xl space-y-6">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center space-y-2.5">
        <Link href="/" className="inline-flex items-center gap-2 group mb-1">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white font-extrabold text-sm h-10 w-10 flex items-center justify-center rounded-xl shadow-md border border-slate-700/40 group-hover:scale-105 transition">
            ST
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">
            StudyTube
          </span>
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Sign in to StudyTube
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
          Access your courses, timestamped notes, Leitner flashcards, and study streaks anywhere.
        </p>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs space-y-1.5 animate-fadeIn">
          <div className="font-bold">Sign-in Notice</div>
          <p className="leading-relaxed">{errorMessage}</p>
        </div>
      )}

      {/* Single-Option "Continue with Google" Action */}
      <div className="space-y-4 pt-1">
        <button
          type="button"
          onClick={handleContinueWithGoogle}
          disabled={signingIn}
          aria-label="Continue with Google"
          className="w-full h-13 py-3.5 px-6 rounded-2xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-800 dark:text-slate-100 font-semibold text-sm sm:text-base transition-all duration-200 shadow-sm hover:shadow flex items-center justify-center gap-3 cursor-pointer group active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {signingIn ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
              <span>Connecting to Google...</span>
            </>
          ) : (
            <>
              {/* Official Google 'G' Logo (SVG) */}
              <svg
                className="w-5 h-5 shrink-0"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
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
            </>
          )}
        </button>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 text-center">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Secure Google Sign-In &bull; No password required</span>
        </div>
      </div>

      {/* Informational feature list */}
      <div className="pt-2 border-t border-gray-100 dark:border-slate-800 space-y-2 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span>Automatic cross-device cloud sync with Google Cloud</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <span>Spaced-repetition flashcards and daily study streaks</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>1-tap sign-in on supported desktop and mobile browsers</span>
        </div>
      </div>

      {/* Back to Home */}
      <div className="text-center pt-1">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 transition-colors selection:bg-blue-500 selection:text-white font-sans">
      <Suspense
        fallback={
          <div className="w-full max-w-md p-10 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl shadow-xl flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        }
      >
        <LoginContent />
      </Suspense>
    </div>
  );
}
