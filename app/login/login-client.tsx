'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Layers, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sendMagicLink } from './actions';
// Note: this client never imports 'resend', RESEND_API_KEY, Supabase client directly, or any email sending logic.
// All auth email (magic link) is handled exclusively by the Server Action above using Supabase signInWithOtp.
// Work-order Resend usage is double-dynamic + server-actions only (never reachable from login or any 'use client' static import).

export default function LoginClient() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the email input on mount (client-only to avoid hydration issues with autoFocus)
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');

  // Live computed validation for enabling the submit button and showing feedback
  const trimmedEmail = email.trim();
  const isValidEmail = trimmedEmail.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

  const handleLogin = async (e?: { preventDefault?: () => void }) => {
    e?.preventDefault?.();
    if (loading) return;

    const trimmed = email.trim();

    if (!trimmed) {
      setError('Please enter your email address.');
      return;
    }

    // Basic but robust email format check (works on desktop + mobile)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const result = await sendMagicLink(trimmed);
      if (result.error) {
        const msg = result.error.toLowerCase();
        if (msg.includes('rate limit') || msg.includes('too many requests')) {
          setError(
            'Email rate limit exceeded. Please wait a few minutes before requesting another magic link, or try logging in with a different email address.'
          );
        } else if (msg.includes('sending') || msg.includes('confirmation') || msg.includes('email')) {
          setError(
            'Error sending magic link email. Please wait a bit, use a different test email, or check your email provider configuration.'
          );
        } else {
          setError(result.error);
        }
      } else {
        setMessage(`Magic link sent to ${email}. Check your inbox (and spam folder).`);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setMessage('');
    setError('');
    setEmail('');
  };

  return (
    <div className="bg-background flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Branding */}
        <div className="flex flex-col items-center text-center">
          <div className="bg-primary text-primary-foreground mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
            <Layers className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">Nestora</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Professional workspace for modern teams.
          </p>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="pb-2 text-center">
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>Sign in with a magic link — no password needed.</CardDescription>
          </CardHeader>
          <CardContent>
            {message ? (
              // Success state after sending magic link
              <div className="space-y-6 py-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-lg font-medium">Check your email</p>
                  <p className="text-muted-foreground mt-1 text-sm">{message}</p>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  className={cn(
                    buttonVariants({ variant: 'outline' }),
                    'w-full touch-manipulation'
                  )}
                  data-1p-ignore="true"
                >
                  Send another link
                </button>
                <p className="text-muted-foreground text-xs">
                  The link will sign you in automatically and redirect you to the dashboard.
                </p>
              </div>
            ) : (
              // Login form
              <form
                ref={formRef}
                onSubmit={handleLogin}
                className="space-y-5"
                // These attributes help prevent password managers and autofill extensions
                // (especially in Firefox) from injecting scripts that can cause runtime errors
                // like "detectStore is undefined" or hydration issues.
                data-form-type="login"
                autoComplete="on"
              >
                {(error || urlError) && (
                  <div className="border-destructive/20 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
                    {error ||
                      (urlError === 'Unable to sign in with magic link'
                        ? 'Unable to sign in. Please request a new link.'
                        : 'An error occurred.')}
                  </div>
                )}

                <div className="space-y-2" suppressHydrationWarning>
                  <label htmlFor="email" className="text-sm font-medium">
                    Email address
                  </label>
                  {/* Use native input here for reliable controlled onChange + value on mobile.
                      The custom Input (base-ui) can have event/control quirks on some mobile browsers
                      that prevent the email state (and thus isValidEmail) from updating, so the
                      submit button never visually enables. Native input guarantees standard behavior. */}
                  <input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      // Always clear any previous error banner when user edits (avoids stale closure issues)
                      setError('');
                    }}
                    required
                    disabled={loading}
                    aria-invalid={!isValidEmail && trimmedEmail.length > 0}
                    autoComplete="email"
                    ref={inputRef}
                    suppressHydrationWarning
                    // These attributes help prevent password managers / autofill extensions
                    // (common cause of "detectStore" errors and hydration mismatches in Firefox)
                    // from injecting their own scripts and styles into the field.
                    data-1p-ignore="true"
                    data-lpignore="true"
                    data-form-type="username"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    className={cn(
                      // Core input styles matching the design system's Input (minus file-specific and h-8)
                      'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 disabled:bg-input/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 w-full min-w-0 rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 md:text-sm',
                      // Make it h-10 like before for the form
                      'h-10'
                    )}
                  />
                  {/* Reserve space for the validation message so the submit button
                      position never shifts on mobile when the message appears/disappears.
                      Shifting targets are a common cause of "tap doesn't register". */}
                  <div className="min-h-[1.25rem]">
                    {trimmedEmail.length > 0 && !isValidEmail && (
                      <p className="text-destructive text-xs">
                        Please enter a valid email address.
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className={cn(
                    buttonVariants({ variant: 'default' }),
                    'h-10 w-full touch-manipulation',
                    // Explicit visual + cursor feedback in addition to the native disabled
                    // attribute. Helps on mobile where :disabled styles or pointer-events
                    // can be finicky, and makes the "enabled" state (full color) obvious.
                    loading || !isValidEmail
                      ? 'cursor-not-allowed opacity-60'
                      : 'bg-primary text-primary-foreground active:scale-[0.985] active:opacity-90'
                  )}
                  disabled={loading || !isValidEmail}
                  onClick={() => handleLogin()}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending magic link...
                    </>
                  ) : (
                    <>
                      Send magic link
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </button>

                <p className="text-muted-foreground text-center text-xs leading-relaxed">
                  We&apos;ll email you a secure link that signs you in instantly. No passwords to
                  remember.
                </p>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-muted-foreground text-center text-xs">
          By continuing you agree to our Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
