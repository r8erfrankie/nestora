import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Mail } from 'lucide-react';

export default function AuthCodeError() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Card className="shadow-sm">
          <CardHeader className="pb-2 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">Unable to sign in</CardTitle>
            <CardDescription>
              The magic link is invalid, has expired, or has already been used.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground text-sm">
              Magic links are single-use and expire after a short time for security.
              Please request a new one.
            </p>

            <Button asChild className="w-full">
              <Link href="/login">
                <Mail className="mr-2 h-4 w-4" />
                Request a new magic link
              </Link>
            </Button>

            <p className="text-muted-foreground text-xs">
              If the problem persists, make sure the link was opened in the same browser
              you used to request it, and that the link has not been clicked before.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
