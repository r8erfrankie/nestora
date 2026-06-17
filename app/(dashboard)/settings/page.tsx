import { Card, CardContent } from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Update your profile, preferences, notifications, and account security.
        </p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex min-h-[400px] items-center justify-center p-6">
          <div className="text-center">
            <p className="text-muted-foreground">This page is under development.</p>
            <p className="text-muted-foreground mt-2 text-sm">
              Account and application settings coming soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
