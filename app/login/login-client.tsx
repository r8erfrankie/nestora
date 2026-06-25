'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { InstallBanner } from '@/app/components/install-banner';

type Step = 'email' | 'code';

export default function LoginClient() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');
  const redirectTo = searchParams.get('redirectTo') ?? '';
  const emailParam = searchParams.get('email') ?? '';
  const skipToCode = searchParams.get('skipToCode') === '1';
  const startAtCode = skipToCode && !!emailParam;

  const [step, setStep] = useState<Step>(startAtCode ? 'code' : 'email');
  const [email, setEmail] = useState(emailParam);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 6-digit OTP
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const verifyingRef = useRef(false); // synchronous guard against concurrent calls
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);

  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (startAtCode) {
      setTimeout(() => digitRefs.current[0]?.focus(), 60);
    } else {
      emailInputRef.current?.focus();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cooldown (rate-limit guard)
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(null);
  const [currentCooldown, setCurrentCooldown] = useState(0);

  useEffect(() => {
    if (!cooldownEnd) { setCurrentCooldown(0); return; }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((cooldownEnd - Date.now()) / 1000));
      setCurrentCooldown(remaining);
      if (remaining === 0) setCooldownEnd(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cooldownEnd]);

  const loadCooldown = (addr: string) => {
    const stored = localStorage.getItem(`otpCooldown_${addr.toLowerCase()}`);
    if (!stored) return;
    const end = parseInt(stored, 10);
    if (end > Date.now()) setCooldownEnd(end);
    else localStorage.removeItem(`otpCooldown_${addr.toLowerCase()}`);
  };

  useEffect(() => { if (email.trim()) loadCooldown(email.trim()); }, [email]);

  const startCooldown = (seconds: number, addr: string) => {
    const end = Date.now() + seconds * 1000;
    setCooldownEnd(end);
    localStorage.setItem(`otpCooldown_${addr.toLowerCase()}`, end.toString());
  };

  const trimmedEmail = email.trim();
  const isValidEmail = trimmedEmail.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

  // ── Step 1: send OTP + magic link ──────────────────────────────────────────
  const handleSendCode = async (e?: { preventDefault?: () => void }) => {
    e?.preventDefault?.();
    if (loading || currentCooldown > 0) return;
    if (!isValidEmail) { setError('Please enter a valid email address.'); return; }

    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const callbackUrl = redirectTo
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`
        : `${window.location.origin}/auth/callback`;

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: { emailRedirectTo: callbackUrl },
      });

      if (otpError) {
        const msg = otpError.message.toLowerCase();
        if (msg.includes('rate limit') || msg.includes('too many')) {
          setError('Too many requests. Please wait a few minutes before trying again.');
          startCooldown(180, trimmedEmail);
        } else {
          setError(otpError.message);
        }
      } else {
        startCooldown(60, trimmedEmail);
        setDigits(['', '', '', '', '', '']);
        setStep('code');
        setTimeout(() => digitRefs.current[0]?.focus(), 60);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: verify the 6-digit code ────────────────────────────────────────
  const handleVerify = async (codeStr: string) => {
    if (codeStr.length !== 6 || verifyingRef.current) return;
    verifyingRef.current = true;
    setVerifying(true);
    setError('');

    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: codeStr,
        type: 'email',
      });

      if (verifyError) {
        setError('Incorrect code. Check your email and try again.');
        setDigits(['', '', '', '', '', '']);
        setTimeout(() => digitRefs.current[0]?.focus(), 60);
      } else {
        // Hard redirect so only the server-side Supabase client uses the new
        // session — router.push causes both client and server to race on the
        // same refresh token, producing "refresh_token_already_used" errors.
        //
        // Resolve the role client-side so we can jump directly to the right
        // dashboard without an intermediate / → /overview redirect chain,
        // which can loop on mobile if the profile read is slow.
        if (redirectTo) {
          window.location.href = redirectTo;
          return;
        }
        try {
          const { data: { user: u } } = await supabase.auth.getUser();
          const { data: prof } = u
            ? await supabase.from('profiles').select('role').eq('id', u.id).single()
            : { data: null };
          const role = (prof as any)?.role as string | null;
          window.location.href =
            role === 'contractor' ? '/contractor' :
            role === 'tenant'     ? '/tenant' :
            role === 'landlord'   ? '/overview' :
            '/select-role';
        } catch {
          window.location.href = '/';
        }
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  };

  // Digit box handlers
  const handleDigitChange = (i: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = digit;
    setDigits(next);
    if (digit) {
      if (i < 5) digitRefs.current[i + 1]?.focus();
      else if (next.every(d => d)) handleVerify(next.join(''));
    }
  };

  const handleDigitKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      digitRefs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      handleVerify(pasted);
    }
    e.preventDefault();
  };

  const codeComplete = digits.every(d => d);

  return (
    <div className="flex min-h-svh flex-col bg-white sm:bg-gray-50" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Install banner — full width at the very top, all screen sizes */}
      <InstallBanner />

      <div className="flex flex-1 flex-col items-center sm:justify-center sm:px-4 sm:py-16">
        <div className="flex w-full flex-1 flex-col sm:block sm:flex-none sm:max-w-[400px]">

          {/* Branding */}
          <div className="flex flex-col items-center px-6 pb-8 pt-8 text-center sm:mb-8 sm:px-0 sm:pb-0 sm:pt-0">
            <Image
              src="/nestora-icon.svg"
              alt="Nestora"
              width={64}
              height={64}
              className="mb-5 rounded-2xl shadow-lg shadow-teal-700/25 sm:h-14 sm:w-14"
            />
            <Image
              src="/nestora-logo.svg"
              alt="Nestora"
              width={160}
              height={41}
              className="mb-1"
            />
            <p className="mt-2 text-sm text-gray-500">Property management made simple</p>
          </div>

          {/* Card — visible border/shadow on desktop only */}
          <div className="flex flex-1 flex-col sm:block sm:flex-none sm:overflow-hidden sm:rounded-2xl sm:border sm:border-gray-200 sm:bg-white sm:shadow-xl sm:shadow-gray-200/80">
            <div className="hidden h-[3px] w-full bg-teal-700 sm:block" />

            <div className="flex flex-1 flex-col px-6 pb-10 sm:flex-none sm:p-8">

              {step === 'email' ? (
                /* ── Email input ── */
                <>
                  <div className="mb-7 text-center">
                    <h2 className="text-xl font-semibold text-gray-900">Welcome back</h2>
                    <p className="mt-1.5 text-sm text-gray-500">
                      Enter your email and we&apos;ll send a 6-digit sign-in code.
                    </p>
                  </div>

                  <form
                    onSubmit={handleSendCode}
                    className="flex flex-1 flex-col sm:flex-none"
                    autoComplete="on"
                  >
                    <div className="space-y-4">
                      {(error || urlError) && (
                        <div className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                          <span className="mt-0.5 shrink-0">⚠</span>
                          <span>
                            {error || (urlError === 'Unable to sign in with magic link'
                              ? 'Unable to sign in. Please request a new code.'
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
                          autoComplete="email"
                          ref={emailInputRef}
                          suppressHydrationWarning
                          data-1p-ignore="true"
                          data-lpignore="true"
                          autoCorrect="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          className={cn(
                            'h-12 w-full rounded-xl border bg-white px-3.5 text-base text-gray-900 placeholder:text-gray-400 outline-none transition-all sm:h-11 sm:text-sm',
                            'focus:ring-2',
                            !isValidEmail && trimmedEmail.length > 0
                              ? 'border-red-300 focus:border-red-400 focus:ring-red-400/15'
                              : 'border-gray-200 focus:border-teal-600 focus:ring-teal-600/15',
                            'disabled:cursor-not-allowed disabled:opacity-60'
                          )}
                        />
                        <div className="min-h-[1.25rem]">
                          {trimmedEmail.length > 0 && !isValidEmail && (
                            <p className="text-xs text-red-600">Please enter a valid email address.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col justify-end gap-4 sm:flex-none sm:gap-0 sm:pt-2">
                      <button
                        type="submit"
                        disabled={loading || !isValidEmail || currentCooldown > 0}
                        className={cn(
                          'flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all touch-manipulation sm:h-11',
                          loading || !isValidEmail || currentCooldown > 0
                            ? 'cursor-not-allowed bg-teal-700/30 text-teal-700/60'
                            : 'bg-teal-700 text-white shadow-sm shadow-teal-700/20 hover:bg-teal-800 active:scale-[0.985]'
                        )}
                      >
                        {currentCooldown > 0
                          ? `Wait ${currentCooldown}s`
                          : loading
                          ? <><Loader2 className="h-4 w-4 animate-spin" />Sending…</>
                          : <>Send code<ArrowRight className="h-4 w-4" /></>}
                      </button>

                      <p className="text-center text-xs leading-relaxed text-gray-400">
                        We&apos;ll email you a 6-digit code. No password needed.
                      </p>
                    </div>
                  </form>
                </>
              ) : (
                /* ── Code entry ── */
                <div className="flex flex-1 flex-col">
                  <div className="mb-6 text-center">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {startAtCode ? 'Enter your invitation code' : 'Enter your code'}
                    </h2>
                    <p className="mt-1.5 text-sm text-gray-500">
                      {startAtCode ? 'From your invitation email — signing in as' : 'Sent to'}
                    </p>
                    <p className="mt-1 inline-block rounded-lg bg-gray-50 px-3 py-1 text-sm font-medium text-gray-800">
                      {trimmedEmail}
                    </p>
                  </div>

                  {error && (
                    <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                      <span className="mt-0.5 shrink-0">⚠</span>
                      <span>{error}</span>
                    </div>
                  )}

                  {/* 6 digit boxes */}
                  <div className="flex justify-center gap-2.5" onPaste={handlePaste}>
                    {digits.map((d, i) => (
                      <input
                        key={i}
                        ref={el => { digitRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={2}
                        value={d}
                        onChange={e => handleDigitChange(i, e.target.value)}
                        onKeyDown={e => handleDigitKeyDown(i, e)}
                        disabled={verifying}
                        aria-label={`Digit ${i + 1}`}
                        className={cn(
                          'h-14 w-11 rounded-xl border text-center text-xl font-bold text-gray-900 outline-none transition-all',
                          'focus:ring-2 focus:ring-teal-600/15 focus:border-teal-600',
                          d ? 'border-teal-600 bg-teal-50' : 'border-gray-200 bg-white',
                          verifying && 'opacity-50'
                        )}
                      />
                    ))}
                  </div>

                  <div className="mt-6 flex flex-1 flex-col justify-end gap-3 sm:flex-none">
                    <button
                      type="button"
                      onClick={() => handleVerify(digits.join(''))}
                      disabled={!codeComplete || verifying}
                      className={cn(
                        'flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all touch-manipulation sm:h-11',
                        'cursor-not-allowed bg-teal-700/30 text-teal-700/60'
                      )}
                    >
                      {verifying || codeComplete
                        ? <><Loader2 className="h-4 w-4 animate-spin" />Verifying…</>
                        : <>Sign in<CheckCircle2 className="h-4 w-4" /></>}
                    </button>

                    <div className="flex items-center justify-center gap-3 text-xs text-gray-400">
                      <button
                        type="button"
                        onClick={() => { setStep('email'); setError(''); setDigits(['', '', '', '', '', '']); }}
                        className="underline-offset-2 hover:text-gray-600 hover:underline"
                      >
                        Wrong email?
                      </button>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => handleSendCode()}
                        disabled={currentCooldown > 0 || loading}
                        className={cn(
                          'underline-offset-2 hover:underline',
                          currentCooldown > 0 ? 'cursor-not-allowed text-gray-300' : 'hover:text-gray-600'
                        )}
                      >
                        {currentCooldown > 0 ? `Resend in ${currentCooldown}s` : 'Resend code'}
                      </button>
                    </div>

                    <p className="text-center text-xs text-gray-400">
                      {startAtCode
                        ? 'Code expired? Hit Resend above to get a new one.'
                        : 'Check your spam folder if the email doesn’t arrive.'}
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>

          <p className="mt-6 hidden text-center text-xs text-gray-400 sm:block">
            By continuing you agree to our{' '}
            <span className="cursor-pointer underline underline-offset-2 hover:text-gray-600">Terms</span>
            {' '}and{' '}
            <span className="cursor-pointer underline underline-offset-2 hover:text-gray-600">Privacy Policy</span>.
          </p>

        </div>
      </div>
    </div>
  );
}
