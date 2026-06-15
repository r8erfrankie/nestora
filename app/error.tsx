'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service in production
    console.error('App error boundary caught:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      <div className="mb-4 text-4xl">⚠️</div>
      <h2 className="mb-4 text-2xl font-semibold">Something went wrong</h2>
      <p className="mb-6 max-w-md text-muted-foreground">
        An unexpected error occurred. Our team has been notified.
      </p>
      <div className="flex gap-4">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = '/')}>
          Go to home
        </Button>
      </div>
      {process.env.NODE_ENV === 'development' && (
        <pre className="mt-8 max-w-full overflow-auto rounded bg-muted p-4 text-left text-xs text-destructive">
          {error.message}
          {error.stack && `\n\n${error.stack}`}
        </pre>
      )}
    </div>
  );
}
