'use client';

import { useEffect } from 'react';

export function SplashDismisser() {
  useEffect(() => {
    const el = document.getElementById('nestora-splash') as HTMLElement | null;
    if (!el) return;
    el.style.transition = 'opacity 0.25s ease';
    el.style.opacity = '0';
    const t = setTimeout(() => el.remove(), 280);
    return () => clearTimeout(t);
  }, []);
  return null;
}
