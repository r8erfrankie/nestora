'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Layers, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
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

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmedEmail = email.trim();
  const isValidEmail = trimmedEmail.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

  const [cooldownEnd, setCooldownEnd] = useState<number | null>(null);
  const [currentCooldown, setCurrentCooldown] = useState(0);

  useEffect(() => {
    if (!cooldownEnd) { setCurrentCooldown(0); return; }
    const update = () => {
      const remaining = Math.max(0, Math.ceil((cooldownEnd - Date.now()) / 1000));
      setCurrentCooldown(remaining);
      if (remaining === 0) setCooldownEnd(null);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [cooldownEnd]);

  const loadCooldown = (emailAddr: string) => {
    if (!emailAddr) return;
    const stored = localStorage.getItem(`magicLinkCooldown_${emailAddr.toLowerCase()}`);
    if (stored) {
      const end = parseInt(stored, 10);
      if (end > Date.now()) setCooldownEnd(end);
      else localStorage.removeItem(`magicLinkCooldown_${emailAddr.toLowerCase()}`);
    }
  };

  useEffect(() => { if (trimmedEmail) loadCooldown(trimmedEmail); }, [trimmedEmail]);

  const startCooldown = (seconds: number, emailAddr: string) => {
    const end = Date.now() + seconds * 1000;
    setCooldownEnd(end);
    localStorage.setItem(`magicLinkCooldown_${emailAddr.toLowerCase()}`, end.toString());
  };

  const handleLogin = async (e?: { preventDefault?: () => void }) => {
    e?.preventDefault?.();
    if (loading || currentCooldown > 0) return;
    const trimmed = email.trim();
    if (!trimmed) { setError('Please enter your email address.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError('Please enter a valid email address.'); return; }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const supabase = createClient();
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
          setError('Email rate limit exceeded. Please wait a few minutes before requesting another magic link.');
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

  return (
    /*
     * Mobile: full-screen white, content flows from top — no floating card.
     * Desktop (sm+): gray background, centered card with border and shadow.
     */
    <div className="flex min-h-svh flex-col bg-white sm:items-center sm:justify-center sm:bg-gray-50 sm:px-4 sm:py-16">
      <div className="flex w-full flex-1 flex-col sm:block sm:flex-none sm:max-w-[400px]">

        {/* ── Branding ── */}
        <div className="flex flex-col items-center px-6 pb-8 pt-16 text-center sm:mb-8 sm:px-0 sm:pb-0 sm:pt-0">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-700 shadow-lg shadow-teal-700/25 sm:h-14 sm:w-14">
            <Layers className="h-8 w-8 text-white sm:h-7 sm:w-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-[-0.03em] text-gray-900 sm:text-3xl">Nestora</h1>
          <p className="mt-2 text-sm text-gray-500">
            Property management made simple
          </p>
        </div>

        {/* ── Card (border + shadow on desktop, invisible wrapper on mobile) ── */}
        <div className="flex flex-1 flex-col sm:block sm:flex-none sm:overflow-hidden sm:rounded-2xl sm:border sm:border-gray-200 sm:bg-white sm:shadow-xl sm:shadow-gray-200/80">
          {/* Teal accent stripe — desktop only */}
          <div className="hidden h-[3px] w-full bg-teal-700 sm:block" />

          <div className="flex flex-1 flex-col px-6 pb-10 sm:flex-none sm:p-8">
            {message ? (
              /* ── Success state ── */
              <div className="flex flex-1 flex-col items-center justify-center text-center sm:flex-none sm:py-1">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 ring-8 ring-teal-50/50">
                  <CheckCircle2 className="h-8 w-8 text-teal-700" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Check your inbox</h2>
                <p className="mt-2 text-sm text-gray-500">We sent a sign-in link to</p>
                <p className="mt-1 inline-block rounded-lg bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-800">
                  {trimmedEmail}
                </p>
                <p className="mt-3 text-xs text-gray-400">
                  Can&apos;t find it? Check your spam or junk folder.
                </p>
                <div className="mt-6 w-full max-w-xs">
                  <button
                    type="button"
                    onClick={() => { setMessage(''); setError(''); }}
                    disabled={currentCooldown > 0}
                    className={cn(
                      'w-full rounded-xl border px-4 py-3 text-sm font-medium transition-colors touch-manipulation',
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
                <div className="mb-7 text-center sm:mb-7">
                  <h2 className="text-xl font-semibold text-gray-900">Welcome back</h2>
                  <p className="mt-1.5 text-sm text-gray-500">
                    Enter your email and we&apos;ll send a secure sign-in link.
                  </p>
                </div>

                <form
                  ref={formRef}
                  onSubmit={handleLogin}
                  className="flex flex-1 flex-col sm:flex-none sm:space-y-4"
                  data-form-type="login"
                  autoComplete="on"
                >
                  <div className="space-y-4 sm:space-y-4">
                    {(error || urlError) && (
                      <div className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                        <span className="mt-0.5 shrink-0 text-red-400">⚠</span>
                        <span>
                          {error || (urlError === 'Unable to sign in with magic link'
                            ? 'Unable to sign in. Please request a new link.'
                            : urlError)}
                        </span>
                      </div>
                    )}

                    <div className="space-y-1.5" suppressHydrationWarning>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        Email address
                      </label>
                      <input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(''); }}
                        required
                        disabled={loading}
                        aria-invalid={!isValidEmail && trimmedEmail.length > 0}
                        autoComplete="email"
                        ref={inputRef}
                        suppressHydrationWarning
                        data-1p-ignore="true"
                        data-lpignore="true"
                        data-form-type="username"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        className={cn(
                          'h-12 w-full rounded-xl border bg-white px-3.5 text-base text-gray-900 placeholder:text-gray-400 outline-none transition-all sm:h-11 sm:text-sm',
                          'focus:ring-2',
                          !isValidEmail && trimmedEmail.length > 0
                            ? 'border-red-300 focus:border-red-400 focus:ring-red-400/15'
                            : 'border-gray-200 focus:border-teal-600 focus:ring-teal-600/15',
                          'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60'
                        )}
                      />
                      <div className="min-h-[1.25rem]">
                        {trimmedEmail.length > 0 && !isValidEmail && (
                          <p className="text-xs text-red-600">Please enter a valid email address.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Push button to bottom on mobile */}
                  <div className="flex flex-1 flex-col justify-end gap-4 sm:flex-none sm:gap-0">
                    <button
                      type="submit"
                      className={cn(
                        'flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all touch-manipulation sm:h-11',
                        loading || !isValidEmail || currentCooldown > 0
                          ? 'cursor-not-allowed bg-teal-700/30 text-teal-700/60'
                          : 'bg-teal-700 text-white shadow-sm shadow-teal-700/20 hover:bg-teal-800 active:scale-[0.985] active:bg-teal-900'
                      )}
                      disabled={loading || !isValidEmail || currentCooldown > 0}
                    >
                      {currentCooldown > 0 ? (
                        `Wait ${currentCooldown}s before sending again`
                      ) : loading ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />Sending link…</>
                      ) : (
                        <>Send magic link<ArrowRight className="h-4 w-4" /></>
                      )}
                    </button>

                    <p className="text-center text-xs leading-relaxed text-gray-400">
                      We&apos;ll email you a secure link that signs you in instantly.
                      <br />No passwords to remember.
                    </p>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Footer — desktop only (on mobile the bottom text is inside the form) */}
        <p className="mt-6 hidden text-center text-xs text-gray-400 sm:block">
          By continuing you agree to our{' '}
          <span className="cursor-pointer underline underline-offset-2 hover:text-gray-600">Terms</span>
          {' '}and{' '}
          <span className="cursor-pointer underline underline-offset-2 hover:text-gray-600">Privacy Policy</span>.
        </p>

      </div>
    </div>
  );
}
