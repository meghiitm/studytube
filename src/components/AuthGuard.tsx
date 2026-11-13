'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useCourses } from '@/context/CourseContext';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectUnauthenticated?: boolean;
}

/**
 * Route guard component protecting authenticated sections & actions.
 * - Shows a loading skeleton while Firebase Auth state is resolving.
 * - If user is unauthenticated and redirectUnauthenticated is true, redirects to /login?returnUrl=...
 * - Otherwise renders fallback login prompt or children.
 */
export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  fallback,
  redirectUnauthenticated = false,
}) => {
  const { user, authLoading } = useCourses();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!authLoading && !user && redirectUnauthenticated) {
      router.push(`/login?returnUrl=${encodeURIComponent(pathname || '/')}`);
    }
  }, [user, authLoading, redirectUnauthenticated, router, pathname]);

  if (authLoading) {
    return (
      <div className="w-full p-8 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="text-xs text-slate-400 font-medium">Verifying sign-in...</span>
      </div>
    );
  }

  if (!user) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-center space-y-4 max-w-md mx-auto shadow-sm">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Sign In Required
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Please sign in with Google to access this feature and keep your study progress synced.
          </p>
        </div>
        <Link
          href={`/login?returnUrl=${encodeURIComponent(pathname || '/')}`}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 text-white text-xs font-semibold transition shadow"
        >
          Continue with Google
        </Link>
      </div>
    );
  }

  return <>{children}</>;
};
