import { Card, CardContent } from '@/components/ui/card';

export default function AnalyticsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Dive deeper into performance metrics, trends, and custom reports.
        </p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex min-h-[400px] items-center justify-center p-6">
          <div className="text-center">
            <p className="text-muted-foreground">This page is under development.</p>
            <p className="text-muted-foreground mt-2 text-sm">
              Advanced analytics and reporting features coming soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
