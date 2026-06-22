'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Layers, Mail, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

export default function LoginClient() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');
  const redirectTo = searchParams.get('redirectTo') ?? '';
  const emailParam = searchParams.get('email') ?? '';

  const [email, setEmail] = useState(emailParam);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the email input on mount (client-only to avoid hydration issues with autoFocus)
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Live computed validation for enabling the submit button and showing feedback
  const trimmedEmail = email.trim();
  const isValidEmail = trimmedEmail.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

  // Cooldown to prevent hitting Supabase email rate limits (per email)
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(null);
  const [currentCooldown, setCurrentCooldown] = useState(0);

  // Timer for cooldown display
  useEffect(() => {
    if (!cooldownEnd) {
      setCurrentCooldown(0);
      return;
    }

    const updateCooldown = () => {
      const remaining = Math.max(0, Math.ceil((cooldownEnd - Date.now()) / 1000));
      setCurrentCooldown(remaining);
      if (remaining === 0) {
        setCooldownEnd(null);
      }
    };

    updateCooldown();
    const intervalId = setInterval(updateCooldown, 1000);
    return () => clearInterval(intervalId);
  }, [cooldownEnd]);

  // Load persisted cooldown for this email (survives refresh)
  const loadCooldown = (emailAddr: string) => {
    if (!emailAddr) return;
    const key = `magicLinkCooldown_${emailAddr.toLowerCase()}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const end = parseInt(stored, 10);
      if (end > Date.now()) {
        setCooldownEnd(end);
      } else {
        localStorage.removeItem(key);
      }
    }
  };

  // Reload cooldown when email changes
  useEffect(() => {
    if (trimmedEmail) {
      loadCooldown(trimmedEmail);
    }
  }, [trimmedEmail]);

  // Start a cooldown (in seconds) and persist it
  const startCooldown = (seconds: number, emailAddr: string) => {
    const end = Date.now() + seconds * 1000;
    setCooldownEnd(end);
    const key = `magicLinkCooldown_${emailAddr.toLowerCase()}`;
    localStorage.setItem(key, end.toString());
  };

  const handleLogin = async (e?: { preventDefault?: () => void }) => {
    e?.preventDefault?.();
    if (loading || currentCooldown > 0) return;

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
      const supabase = createClient();
      // Forward the post-login destination through the magic link so the auth
      // callback can redirect there instead of the default role-based route.
      const callbackUrl = redirectTo
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`
        : `${window.location.origin}/auth/callback`;
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: callbackUrl },
      });

      if (otpError) {
        const msg = otpError.message.toLowerCase();
        if (msg.includes('rate limit') || msg.includes('too many requests')) {
          setError(
            'Email rate limit exceeded. Please wait a few minutes before requesting another magic link.'
          );
          startCooldown(180, trimmed);
        } else {
          setError(otpError.message);
        }
      } else {
        setMessage(`Magic link sent to ${email}. Check your inbox (and spam folder).`);
        startCooldown(60, trimmed);
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
    // Keep the email so the user can easily request another after the cooldown
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-gray-50 px-4 py-16">
      <div className="w-full max-w-[400px]">

        {/* Branding */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-700 shadow-lg shadow-teal-700/30">
            <Layers className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-[-0.03em] text-gray-900">Nestora</h1>
          <p className="mt-2 text-sm text-gray-500">
            Property management for serious landlords
          </p>
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-200/80">
          {/* Teal accent stripe */}
          <div className="h-[3px] w-full bg-teal-700" />

          <div className="p-8">
            {message ? (
              /* ── Success state ── */
              <div className="py-1 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 ring-8 ring-teal-50/50">
                  <CheckCircle2 className="h-8 w-8 text-teal-700" />
                </div>

                <h2 className="text-xl font-semibold text-gray-900">Check your inbox</h2>
                <p className="mt-2 text-sm text-gray-500">
                  We sent a sign-in link to
                </p>
                <p className="mt-1 rounded-lg bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-800 inline-block">
                  {trimmedEmail}
                </p>
                <p className="mt-3 text-xs text-gray-400">
                  Can&apos;t find it? Check your spam or junk folder.
                </p>

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={currentCooldown > 0}
                    className={cn(
                      'w-full rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors touch-manipulation',
                      currentCooldown > 0
                        ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                    )}
                    data-1p-ignore="true"
                  >
                    {currentCooldown > 0 ? `Resend in ${currentCooldown}s` : 'Send another link'}
                  </button>
                </div>

                <p className="mt-5 text-xs leading-relaxed text-gray-400">
                  The link signs you in instantly and expires after 1 hour.
                </p>
              </div>
            ) : (
              /* ── Login form ── */
              <>
                <div className="mb-7 text-center">
                  <h2 className="text-xl font-semibold text-gray-900">Welcome back</h2>
                  <p className="mt-1.5 text-sm text-gray-500">
                    Enter your email and we&apos;ll send a secure sign-in link.
                  </p>
                </div>

                <form
                  ref={formRef}
                  onSubmit={handleLogin}
                  className="space-y-4"
                  // These attributes help prevent password managers and autofill extensions
                  // (especially in Firefox) from injecting scripts that can cause runtime errors
                  // like "detectStore is undefined" or hydration issues.
                  data-form-type="login"
                  autoComplete="on"
                >
                  {(error || urlError) && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                      <span className="mt-0.5 shrink-0 text-red-400">⚠</span>
                      <span>
                        {error ||
                          (urlError === 'Unable to sign in with magic link'
                            ? 'Unable to sign in. Please request a new link.'
                            : urlError)}
                      </span>
                    </div>
                  )}

                  <div className="space-y-1.5" suppressHydrationWarning>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email address
                    </label>
                    {/* Use native input here for reliable controlled onChange + value on mobile.
                        The custom Input (base-ui) can have event/control quirks on some mobile browsers
                        that prevent the email state (and thus isValidEmail) from updating, so the
                        submit button never visually enables. Native input guarantees standard behavior. */}
                    <input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
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
                        'h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all',
                        'focus:ring-2',
                        !isValidEmail && trimmedEmail.length > 0
                          ? 'border-red-300 focus:border-red-400 focus:ring-red-400/15'
                          : 'border-gray-200 focus:border-teal-600 focus:ring-teal-600/15',
                        'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60'
                      )}
                    />
                    {/* Reserve space for the validation message so the submit button
                        position never shifts on mobile when the message appears/disappears.
                        Shifting targets are a common cause of "tap doesn't register". */}
                    <div className="min-h-[1.25rem]">
                      {trimmedEmail.length > 0 && !isValidEmail && (
                        <p className="text-xs text-red-600">
                          Please enter a valid email address.
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className={cn(
                      'flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all touch-manipulation',
                      loading || !isValidEmail || currentCooldown > 0
                        ? 'cursor-not-allowed bg-teal-700/30 text-teal-700/60'
                        : 'bg-teal-700 text-white shadow-sm shadow-teal-700/20 hover:bg-teal-800 active:scale-[0.985] active:bg-teal-900'
                    )}
                    disabled={loading || !isValidEmail || currentCooldown > 0}
                  >
                    {currentCooldown > 0 ? (
                      `Wait ${currentCooldown}s before sending again`
                    ) : loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending link…
                      </>
                    ) : (
                      <>
                        Send magic link
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  <p className="text-center text-xs leading-relaxed text-gray-400">
                    We&apos;ll email you a secure link that signs you in instantly.
                    <br />No passwords to remember.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-400">
          By continuing you agree to our{' '}
          <span className="underline underline-offset-2 cursor-pointer hover:text-gray-600">Terms</span>
          {' '}and{' '}
          <span className="underline underline-offset-2 cursor-pointer hover:text-gray-600">Privacy Policy</span>.
        </p>

      </div>
    </div>
  );
}
