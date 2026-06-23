'use client';

import { useState, useEffect } from 'react';
import { Layers, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function InstallBanner() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) return;
    if (localStorage.getItem('nestora_install_dismissed')) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase());
    setIsIOS(ios);
    if (ios) setShow(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
      localStorage.setItem('nestora_install_dismissed', '1');
    }
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem('nestora_install_dismissed', '1');
  };

  if (!show) return null;

  return (
    <div className="overflow-hidden border-b border-teal-100 bg-teal-50">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-teal-700">
            <Layers className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-medium text-teal-900">Install the Nestora app</span>
        </div>
        <ChevronDown className={cn(
          'h-4 w-4 text-teal-600 transition-transform duration-200',
          open && 'rotate-180'
        )} />
      </button>

      {open && (
        <div className="border-t border-teal-100 px-4 pb-4 pt-3">
          {isIOS ? (
            <div className="space-y-3 text-sm text-teal-800">
              <p className="font-medium">Add to your home screen:</p>
              <ol className="space-y-2 text-teal-700">
                {([
                  <span key={0}>Tap the <strong>Share</strong> button (↑) at the bottom of Safari</span>,
                  <span key={1}>Scroll and tap <strong>&ldquo;Add to Home Screen&rdquo;</strong></span>,
                  <span key={2}>Tap <strong>Add</strong> — Nestora appears on your home screen</span>,
                ] as React.ReactNode[]).map((content, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-700 text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                    {content}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-teal-800">Get the full app experience on your device.</p>
              <button
                type="button"
                onClick={handleInstall}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 text-sm font-semibold text-white transition-colors hover:bg-teal-800 active:bg-teal-900"
              >
                Install Nestora
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="mt-3 w-full text-center text-xs text-teal-500 hover:text-teal-700"
          >
            No thanks
          </button>
        </div>
      )}
    </div>
  );
}
