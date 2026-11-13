/**
 * Optional AI helper loader for Puter.js chat (used only when no Gemini API key is configured).
 * Notice: All Puter Auth, Puter KV, and Puter account login logic has been completely removed.
 * User authentication is handled 100% via Google Sign-In & Firebase.
 */

declare global {
  interface Window {
    puter?: {
      ai?: {
        chat: (prompt: string) => Promise<any>;
      };
    };
  }
}

const PUTER_SCRIPT_URL = 'https://js.puter.com/v2/';
let puterLoadPromise: Promise<void> | null = null;

export function loadPuterScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Puter SDK only runs in the browser'));
  }
  if (window.puter?.ai) return Promise.resolve();
  if (puterLoadPromise) return puterLoadPromise;

  puterLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${PUTER_SCRIPT_URL}"]`
    );
    if (existing) {
      if (window.puter?.ai) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load AI script')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = PUTER_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      puterLoadPromise = null;
      reject(new Error('Failed to load AI script'));
    };
    document.head.appendChild(script);
  });

  return puterLoadPromise;
}
