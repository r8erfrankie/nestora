'use client';

import { LoadingScreen } from './animated-logo';
import { APP_MOUNTED_FLAG } from './app-mounted-marker';

/**
 * Wraps LoadingScreen so the full-screen splash only appears on a true cold
 * launch — the first render of this app instance — and stays out of the way
 * for every subsequent client-side navigation within the same session (e.g.
 * tapping between Work Orders / Tenants / Properties). AppMountedMarker (in
 * the root layout) sets the sessionStorage flag this checks once the first
 * real page has rendered.
 *
 * During the initial server-rendered pass there's no sessionStorage to read,
 * so this defaults to showing the splash — which is exactly what we want for
 * a genuine cold launch. Subsequent Suspense fallbacks triggered by
 * client-side navigation run entirely client-side (no fresh SSR pass), so by
 * then the flag is already set and this correctly renders nothing.
 */
export function LoadingGate() {
  const alreadyMounted =
    typeof window !== 'undefined' && sessionStorage.getItem(APP_MOUNTED_FLAG) === '1';

  if (alreadyMounted) return null;

  return <LoadingScreen />;
}
