import { LoadingScreen } from '@/components/animated-logo';

// Route-level loading UI for the dashboard segment (overview, work-orders,
// tenants, properties, teams, settings). Without this, Next.js has nothing
// to stream to the browser until the whole page — including every Supabase
// query in its data-fetching — fully resolves server-side, which is what
// produced a long blank/black screen on cold loads. More specific segments
// (tenant/, contractor/) already have their own loading.tsx and take
// precedence over this one.
export default function DashboardLoading() {
  return <LoadingScreen />;
}
