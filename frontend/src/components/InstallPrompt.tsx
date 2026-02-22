'use client';

import { useEffect, useState } from 'react';

/**
 * Shows an install banner on iOS (where the browser can't auto-prompt)
 * and handles the Android beforeinstallprompt event.
 */
export default function InstallPrompt() {
  const [showIOSBanner, setShowIOSBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Already installed — don't show anything
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    const alreadyDismissed = localStorage.getItem('install-dismissed') === '1';

    if (alreadyDismissed) return;

    if (isIOS) {
      setShowIOSBanner(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem('install-dismissed', '1');
    setShowIOSBanner(false);
    setDeferredPrompt(null);
    setDismissed(true);
  };

  const installAndroid = async () => {
    if (!deferredPrompt) return;
    (deferredPrompt as BeforeInstallPromptEvent).prompt();
    dismiss();
  };

  if (dismissed) return null;

  if (showIOSBanner) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-xl">
        <p className="text-white font-semibold text-sm mb-1">Add to Home Screen</p>
        <p className="text-slate-400 text-xs mb-3">
          Tap <strong className="text-white">Share ↑</strong> then{' '}
          <strong className="text-white">Add to Home Screen</strong> to install this app.
        </p>
        <button onClick={dismiss} className="text-slate-500 text-xs hover:text-white">
          Dismiss
        </button>
      </div>
    );
  }

  if (deferredPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-xl flex items-center gap-3">
        <div className="flex-1">
          <p className="text-white font-semibold text-sm">Install app</p>
          <p className="text-slate-400 text-xs">Get it on your home screen for quick access</p>
        </div>
        <button
          onClick={installAndroid}
          className="bg-sky-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-sky-500 transition-colors"
        >
          Install
        </button>
        <button onClick={dismiss} className="text-slate-500 hover:text-white">
          ✕
        </button>
      </div>
    );
  }

  return null;
}

// Extend Window for TypeScript
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}
