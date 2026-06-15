import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function DashboardLoading() {
  return (
    <div className="space-y-8 p-6">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="bg-muted h-8 w-48 animate-pulse rounded" />
          <div className="bg-muted h-4 w-64 animate-pulse rounded" />
        </div>
        <div className="bg-muted h-8 w-32 animate-pulse rounded" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="bg-muted h-3 w-24 animate-pulse rounded" />
              <div className="bg-muted mt-2 h-8 w-16 animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="bg-muted h-3 w-32 animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="bg-muted h-5 w-32 animate-pulse rounded" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="bg-muted h-2 w-2 animate-pulse rounded-full" />
              <div className="flex-1 space-y-1">
                <div className="bg-muted h-4 w-full animate-pulse rounded" />
                <div className="bg-muted h-3 w-16 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
