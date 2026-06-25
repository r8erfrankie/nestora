export default function TenantLoading() {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex gap-4">
        <div className="h-[120px] flex-1 animate-pulse rounded-xl bg-muted" />
        <div className="h-[120px] flex-1 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}
