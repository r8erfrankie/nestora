'use client';

import { useState, useEffect } from 'react';

export function SplashScreen() {
  const [phase, setPhase] = useState<'visible' | 'fading' | 'gone'>('visible');

  useEffect(() => {
    setPhase('fading');
    const t = setTimeout(() => setPhase('gone'), 280);
    return () => clearTimeout(t);
  }, []);

  if (phase === 'gone') return null;

  return (
    <div
      id="nestora-splash"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        opacity: phase === 'fading' ? 0 : 1,
        transition: phase === 'fading' ? 'opacity 0.25s ease' : undefined,
      }}
    >
      <svg viewBox="0 0 120 120" width="72" height="72" fill="none" aria-hidden="true">
        <path id="sp-roof" d="M20 42 L60 18 L100 42"
          stroke="#F2B069" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
        <path id="sp-left" d="M30.5 40 L30.5 104"
          stroke="#0F766E" strokeWidth="17" strokeLinecap="butt" pathLength="1" />
        <path id="sp-right" d="M89.5 40 L89.5 104"
          stroke="#0F766E" strokeWidth="17" strokeLinecap="butt" pathLength="1" />
        <path id="sp-diag" d="M31 46 L88 99"
          stroke="#0F766E" strokeWidth="17" strokeLinecap="round" pathLength="1" />
      </svg>
    </div>
  );
}
