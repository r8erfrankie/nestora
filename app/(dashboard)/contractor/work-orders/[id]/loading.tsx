export default function Loading() {
  return (
    <div className="space-y-5 pb-32">
      {/* Back link skeleton */}
      <div className="h-4 w-20 animate-pulse rounded bg-muted" />

      {/* Title + status */}
      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <div className="h-7 flex-1 animate-pulse rounded bg-muted" />
          <div className="h-7 w-24 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="flex gap-1.5">
          <div className="h-5 w-20 animate-pulse rounded bg-muted" />
          <div className="h-5 w-16 animate-pulse rounded bg-muted" />
        </div>
      </div>

      {/* Quote skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        <div className="h-10 w-full animate-pulse rounded bg-muted" />
      </div>

      {/* Description skeleton */}
      <div className="space-y-1.5">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-20 w-full animate-pulse rounded-lg bg-muted" />
      </div>

      {/* Photos skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-square animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
