import { LoadingGate } from '@/components/loading-gate';

// Route-level loading UI for the dashboard segment (overview, work-orders,
// tenants, properties, teams, settings). Without this, Next.js has nothing
// to stream to the browser until the whole page — including every Supabase
// query in its data-fetching — fully resolves server-side, which is what
// produced a long blank/black screen on cold loads. More specific segments
// (tenant/, contractor/) already have their own loading.tsx and take
// precedence over this one.
//
// Uses LoadingGate (not LoadingScreen directly): this segment is the
// nearest Suspense boundary for every one of those pages (none has its own
// more specific loading.tsx), so without gating it, the full splash would
// flash on every in-app navigation between them — not just the initial
// cold launch.
export default function DashboardLoading() {
  return <LoadingGate />;
}
