import Link from 'next/link';
import { InstallBanner } from '@/app/components/install-banner';
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
          <span className="text-lg font-bold tracking-tight text-teal-700">Nestora</span>
          <Link
            href="/sign-in"
            className="rounded-lg border border-teal-200 bg-white px-4 py-1.5 text-sm font-medium text-teal-700 shadow-sm transition-colors hover:bg-teal-50"
          >
            Sign In
          </Link>
        </div>
      </header>

      <InstallBanner />

      {/* ── Hero ── */}
      <section className="mx-auto max-w-4xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24 lg:pt-32">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3.5 py-1.5 text-xs font-medium text-teal-700">
          Built for landlords with 1–30 properties
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
          Maintenance made simple
          <br />
          <span className="text-teal-600">for small landlords.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-gray-500 sm:text-lg">
          Nestora is the simple pipeline that connects tenants, landlords, and contractors.
          Submit requests with photos, assign work orders, and keep everyone in sync —
          without the chaos of emails and spreadsheets.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3">
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-7 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-800"
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
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="mb-8 text-2xl font-bold tracking-tight text-teal-700 sm:text-3xl">
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
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
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
      <section className="bg-slate-50 py-20">
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
                  <div className="absolute left-full top-5 z-10 hidden w-full border-t-2 border-dashed border-teal-200 sm:block" style={{ width: '2rem', left: 'calc(100% + 0.25rem)' }} />
                )}
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-sm font-bold text-white">
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

      {/* ── See it in action ── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-3 text-2xl font-bold tracking-tight text-teal-700 sm:text-3xl">
            See it in action
          </h2>
          <p className="mb-12 text-gray-500">
            Clean, focused screens built for every person in the loop.
          </p>

          <div className="grid items-start gap-8 sm:grid-cols-3">

            {/* Landlord — browser mockup */}
            <div className="flex flex-col gap-4">
              <span className="inline-flex w-fit items-center rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-200">
                For landlords
              </span>
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md">
                <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50 px-3 py-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                  <div className="mx-2 flex-1 truncate rounded border border-gray-200 bg-white px-2 py-0.5 text-[9px] text-gray-400">
                    gonestora.app/work-orders
                  </div>
                </div>
                <img
                  src="/screenshots/landlord-work-orders.png"
                  alt="Landlord work orders dashboard"
                  className="block w-full"
                  loading="lazy"
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Work order management</p>
                <p className="mt-0.5 text-sm text-gray-500">
                  Track every job across all your properties in one place.
                </p>
              </div>
            </div>

            {/* Contractor — phone mockup */}
            <div className="flex flex-col gap-4">
              <span className="inline-flex w-fit items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                For contractors
              </span>
              <div className="mx-auto w-[75%] sm:mx-0 sm:w-full">
                <div className="overflow-hidden rounded-[1.75rem] border-[4px] border-gray-800 bg-gray-800 shadow-xl">
                  <div className="flex items-center justify-center bg-gray-800 py-2">
                    <div className="h-1 w-12 rounded-full bg-gray-600" />
                  </div>
                  <div className="h-[280px] overflow-hidden bg-white">
                    <img
                      src="/screenshots/contractor-work-orders.png"
                      alt="Contractor mobile work orders view"
                      className="block w-full"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex items-center justify-center bg-gray-800 py-2">
                    <div className="h-1 w-8 rounded-full bg-gray-600" />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Jobs on the go</p>
                <p className="mt-0.5 text-sm text-gray-500">
                  Accept and manage work orders from anywhere.
                </p>
              </div>
            </div>

            {/* Tenant — phone mockup */}
            <div className="flex flex-col gap-4">
              <span className="inline-flex w-fit items-center rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 ring-1 ring-purple-200">
                For tenants
              </span>
              <div className="mx-auto w-[75%] sm:mx-0 sm:w-full">
                <div className="overflow-hidden rounded-[1.75rem] border-[4px] border-gray-800 bg-gray-800 shadow-xl">
                  <div className="flex items-center justify-center bg-gray-800 py-2">
                    <div className="h-1 w-12 rounded-full bg-gray-600" />
                  </div>
                  <div className="h-[280px] overflow-hidden bg-white">
                    <img
                      src="/screenshots/tenant-request.png"
                      alt="Tenant maintenance request dashboard"
                      className="block w-full"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex items-center justify-center bg-gray-800 py-2">
                    <div className="h-1 w-8 rounded-full bg-gray-600" />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Maintenance tracking</p>
                <p className="mt-0.5 text-sm text-gray-500">
                  Submit requests and track progress without phone calls.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Key Features ── */}
      <section className="bg-slate-50 py-20">
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
                <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-teal-500" />
                <span className="text-sm text-gray-700">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="bg-teal-900 py-24">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to simplify your maintenance?
          </h2>
          <p className="mt-4 text-teal-200">
            Join landlords who manage properties without the chaos.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3">
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-teal-900 shadow-sm transition-colors hover:bg-teal-50"
            >
              Sign In to Nestora
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="text-xs text-teal-400">
              Already have an account?{' '}
              <Link href="/sign-in" className="text-teal-300 underline underline-offset-2 hover:text-white">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-gray-400 sm:flex-row sm:px-6">
          <span className="font-semibold text-teal-700">Nestora</span>
          <span>Built for small landlords who value clarity and simplicity.</span>
          <Link href="/sign-in" className="transition-colors hover:text-teal-700">
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
