import { LoadingGate } from '@/components/loading-gate';

// Root-level loading UI. Covers app/page.tsx specifically — the PWA's
// start_url — which does its own auth check, profile lookup, and redirect
// before anything else renders. Without this, that hop had no fallback UI
// to stream while it ran. Static routes (landing, tools, login) render fast
// enough that this never gets a visible window to show, and login/ already
// has its own more specific loading.tsx that takes precedence anyway.
//
// Uses LoadingGate (not LoadingScreen directly) so the splash only appears
// on a true cold launch, not on every subsequent client-side navigation.
export default function RootLoading() {
  return <LoadingGate />;
}
