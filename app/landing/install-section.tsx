'use client';

import { useState } from 'react';
import { ChevronDown, Smartphone, Monitor, Apple } from 'lucide-react';
import { cn } from '@/lib/utils';

const PLATFORMS = [
  {
    id: 'ios',
    label: 'iPhone & iPad',
    icon: Apple,
    note: 'Safari required',
    steps: [
      'Open gonestora.app in Safari',
      'Tap the Share button (↑) at the bottom of the screen',
      'Scroll down and tap "Add to Home Screen"',
      'Tap Add — Nestora appears on your home screen',
    ],
  },
  {
    id: 'android',
    label: 'Android',
    icon: Smartphone,
    note: 'Chrome required',
    steps: [
      'Open gonestora.app in Chrome',
      'Tap the three-dot menu (⋮) in the top right',
      'Tap "Add to Home Screen" or "Install App"',
      'Tap Add — Nestora appears on your home screen',
    ],
  },
  {
    id: 'desktop',
    label: 'Desktop',
    icon: Monitor,
    note: 'Chrome or Edge',
    steps: [
      'Open gonestora.app in Chrome or Edge',
      'Click the install icon (⊕) in the address bar',
      'Click Install in the prompt that appears',
      'Nestora opens as a standalone app on your desktop',
    ],
  },
] as const;

export function InstallSection() {
  const [open, setOpen] = useState<string | null>(null);

  const toggle = (id: string) => setOpen(prev => (prev === id ? null : id));

  return (
    <section className="py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="mb-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Works on every device
        </h2>
        <p className="mb-10 text-gray-500">
          No App Store. No download. Install directly from your browser in seconds.
        </p>

        <div className="space-y-3">
          {PLATFORMS.map(({ id, label, icon: Icon, note, steps }) => {
            const isOpen = open === id;
            return (
              <div
                key={id}
                className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{label}</p>
                      <p className="text-xs text-gray-400">{note}</p>
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200',
                      isOpen && 'rotate-180'
                    )}
                  />
                </button>

                <div
                  className={cn(
                    'grid transition-all duration-200',
                    isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="border-t border-gray-50 px-5 pb-5 pt-4">
                      <ol className="space-y-3">
                        {steps.map((step, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-700 text-[10px] font-bold leading-none text-white">
                              {i + 1}
                            </span>
                            <span className="text-sm text-gray-600">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
