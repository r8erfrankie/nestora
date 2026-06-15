import { Suspense } from 'react';
import LoginClient from './login-client';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <LoginClient />
    </Suspense>
  );
}

export const dynamic = 'force-dynamic';
