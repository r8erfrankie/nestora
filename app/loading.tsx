import { LoadingScreen } from '@/components/animated-logo';

// Root-level loading UI. Covers app/page.tsx specifically — the PWA's
// start_url — which does its own auth check, profile lookup, and redirect
// before anything else renders. Without this, that hop had no fallback UI
// to stream while it ran. Static routes (landing, tools, login) render fast
// enough that this never gets a visible window to show, and login/ already
// has its own more specific loading.tsx that takes precedence anyway.
export default function RootLoading() {
  return <LoadingScreen />;
}
