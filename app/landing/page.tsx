import Link from 'next/link';
import {
  Camera,
  Users,
  ClipboardList,
  Bell,
  Smartphone,
  Zap,
  CheckCircle2,
  Building2,
  Wrench,
  ArrowRight,
} from 'lucide-react';

export const metadata = {
  title: 'Nestora — Maintenance made simple for small landlords',
  description:
    'The simple pipeline that connects tenants, landlords, and contractors. Submit requests with photos, assign work orders, and keep everyone in sync.',
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 antialiased">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <span className="text-lg font-bold tracking-tight">Nestora</span>
          <Link
            href="/sign-in"
            className="rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-800 shadow-sm transition-colors hover:bg-gray-50"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-4xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24 lg:pt-32">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3.5 py-1.5 text-xs font-medium text-gray-600">
          Built for landlords with 1–30 properties
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
          Maintenance made simple
          <br />
          <span className="text-gray-400">for small landlords.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-gray-500 sm:text-lg">
          Nestora is the simple pipeline that connects tenants, landlords, and contractors.
          Submit requests with photos, assign work orders, and keep everyone in sync —
          without the chaos of emails and spreadsheets.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3">
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-7 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-700"
          >
            Sign In to Nestora
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-xs text-gray-400">
            No credit card required &nbsp;·&nbsp; Built for landlords with 1–30 properties
          </p>
        </div>
      </section>

      {/* ── What Nestora Does ── */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="mb-8 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            What Nestora does
          </h2>
          <div className="space-y-5 text-base leading-relaxed text-gray-600 sm:text-[17px]">
            <p>
              Nestora is a maintenance-focused platform that makes maintenance requests,
              work orders, and tenant communication dramatically simpler — without the
              overhead of bloated, expensive property management software.
            </p>
            <p>
              Tenants submit requests with photos in seconds. Contractors get clear
              information. Landlords stay informed without constant follow-ups. It&rsquo;s the
              straightforward pipeline small landlords actually need.
            </p>
          </div>
        </div>
      </section>

      {/* ── Built on Better Principles ── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-3 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Built on better principles
          </h2>
          <p className="mb-12 text-gray-500">
            Five ideas that drive every decision we make.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
                  <p.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-1.5 font-semibold text-gray-900">{p.title}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-3 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            How it works
          </h2>
          <p className="mb-12 text-gray-500">Three steps. That&rsquo;s really it.</p>

          <div className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="relative">
                {/* Connector line on desktop */}
                {i < STEPS.length - 1 && (
                  <div className="absolute left-full top-5 z-10 hidden w-full border-t-2 border-dashed border-gray-200 sm:block" style={{ width: '2rem', left: 'calc(100% + 0.25rem)' }} />
                )}
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-gray-200 bg-white text-sm font-bold text-gray-400">
                    {i + 1}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{step.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-gray-500">{step.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Key Features ── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-3 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Everything you need, nothing you don&rsquo;t
          </h2>
          <p className="mb-12 text-gray-500">
            No expensive add-ons. No features you&rsquo;ll never use.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f}
                className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
              >
                <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-gray-400" />
                <span className="text-sm text-gray-700">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="bg-gray-900 py-24">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to simplify your maintenance?
          </h2>
          <p className="mt-4 text-gray-400">
            Join landlords who manage properties without the chaos.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3">
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-100"
            >
              Sign In to Nestora
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="text-xs text-gray-500">
              Already have an account?{' '}
              <Link href="/sign-in" className="text-gray-400 underline underline-offset-2 hover:text-white">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-gray-400 sm:flex-row sm:px-6">
          <span className="font-semibold text-gray-700">Nestora</span>
          <span>Built for small landlords who value clarity and simplicity.</span>
          <Link href="/sign-in" className="hover:text-gray-600">
            Sign In →
          </Link>
        </div>
      </footer>

    </div>
  );
}

/* ── Data ── */

const PRINCIPLES = [
  {
    icon: Wrench,
    title: 'Contractor-first',
    body: 'The people doing the work get the best tools. Clear information, upfront.',
  },
  {
    icon: Camera,
    title: 'Photo > Text',
    body: 'A picture of the problem beats a paragraph every time. Photos are first-class.',
  },
  {
    icon: Bell,
    title: 'Status is everything',
    body: 'Everyone always knows where a request stands — no need to ask.',
  },
  {
    icon: Smartphone,
    title: 'Mobile is non-negotiable',
    body: 'Most updates happen on phones. The experience is built for that.',
  },
  {
    icon: Zap,
    title: 'Minimal friction',
    body: 'Tenants can submit their first request quickly, even without an account.',
  },
] as const;

const STEPS = [
  {
    title: 'Add your properties and contractors',
    body: 'Set up your property portfolio and contractor directory in minutes. No complicated onboarding.',
  },
  {
    title: 'Receive maintenance requests with photos',
    body: 'Tenants submit requests directly. You get all the details — including photos — in one place.',
  },
  {
    title: 'Assign, track, and close work orders',
    body: 'Convert requests to work orders, assign contractors, and track progress to completion.',
  },
] as const;

const FEATURES = [
  'Photo-first maintenance requests',
  'Role-based access (Landlord / Contractor / Tenant)',
  'Clean work order management',
  'Contractor directory and easy assignment',
  'Real-time status updates',
  'Tenant entry point for requests (coming soon)',
] as const;
