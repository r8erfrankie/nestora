export default function RequestDetailLoading() {
  return (
    <div className="max-w-2xl space-y-4 sm:space-y-6">
      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
      <div className="space-y-2">
        <div className="h-7 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="divide-y rounded-lg border">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-20 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
