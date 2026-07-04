import Image from 'next/image';
import Link from 'next/link';
import { InstallBanner } from '@/app/components/install-banner';
import { InstallSection } from './install-section';
import {
  Zap,
  Smartphone,
  KeyRound,
  Building2,
  UserCheck,
  Wrench,
  ArrowRight,
} from 'lucide-react';

export const metadata = {
  title: 'Nestora — Your first work order in under 5 minutes',
  description:
    'Maintenance and work-order software for landlords who’d rather fix problems than fight with software. No app to download. No accounts for your tenants or contractors.',
  alternates: {
    canonical: 'https://gonestora.app',
  },
  openGraph: {
    title: 'Nestora — Your first work order in under 5 minutes',
    description:
      'No app to download. No accounts for your tenants or contractors. Just a simple pipeline from maintenance request to finished job.',
    url: 'https://gonestora.app',
    siteName: 'Nestora',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nestora — Your first work order in under 5 minutes',
    description:
      'No app to download. No accounts for your tenants or contractors. Just a simple pipeline from maintenance request to finished job.',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Nestora',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, iOS, Android',
  url: 'https://gonestora.app',
  description:
    'Property maintenance management platform connecting landlords, tenants, and contractors. Submit maintenance requests with photos, assign work orders, and track progress — no app download or tenant/contractor accounts required.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  audience: {
    '@type': 'Audience',
    audienceType: 'Small landlords, property managers, tenants, contractors',
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
          <Image
            src="/nestora-logo.svg"
            alt="Nestora"
            width={120}
            height={30}
            priority
            className="w-[92px] shrink-0 sm:w-[120px]"
            style={{ height: 'auto' }}
          />
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <a
              href="#install"
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium whitespace-nowrap text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900 sm:px-4 sm:py-1.5 sm:text-sm"
            >
              Install App
            </a>
            <Link
              href="/sign-in"
              className="rounded-lg border border-teal-200 bg-white px-2.5 py-1 text-xs font-medium whitespace-nowrap text-teal-700 shadow-sm transition-colors hover:bg-teal-50 sm:px-4 sm:py-1.5 sm:text-sm"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      <InstallBanner />

      {/* ── Hero ── */}
      <section className="mx-auto max-w-4xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24 lg:pt-28">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
          Your first work order
          <br />
          <span className="text-teal-600">in under 5 minutes.</span>
        </h1>

        <h2 className="mx-auto mt-4 max-w-2xl text-lg font-semibold text-gray-500 sm:text-xl">
          The no hassle maintenance and work-order software for small landlords.
        </h2>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/sign-in"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-7 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 sm:w-auto"
          >
            Start free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-7 py-3.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 sm:w-auto"
          >
            See how it works
          </a>
        </div>
      </section>

      {/* ── Hook Strip ── */}
      <section className="border-y border-gray-100 bg-slate-50 py-12">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:grid-cols-3 sm:gap-6 sm:px-6">
          {HOOKS.map((hook) => (
            <div key={hook.title} className="flex items-start gap-3.5 sm:flex-col sm:items-start sm:gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <hook.icon className="h-5 w-5" />
              </div>
              <p className="text-sm leading-relaxed text-gray-700 sm:text-[15px]">
                <span className="font-semibold text-gray-900">{hook.title}</span>{' '}
                {hook.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Built for three people ── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-3 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Built for three people
          </h2>
          <p className="mb-12 text-gray-500">
            Everyone in the loop gets exactly what they need — nothing more.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            {AUDIENCES.map((a) => (
              <div
                key={a.role}
                className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                  <a.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-1.5 font-semibold text-gray-900">{a.role}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="bg-slate-50 py-20">
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

      <InstallSection />

      {/* ── Final CTA ── */}
      <section className="bg-teal-900 py-24">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <Image
            src="/nestora-symbol-reversed.svg"
            alt=""
            width={56}
            height={56}
            className="mx-auto mb-6"
            aria-hidden="true"
          />
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Built by landlords, for landlords.
          </h2>

          <div className="mt-10 flex flex-col items-center gap-3">
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-teal-900 shadow-sm transition-colors hover:bg-teal-50"
            >
              Start free
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
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="transition-colors hover:text-teal-700">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-teal-700">Terms</Link>
            <Link href="/sign-in" className="transition-colors hover:text-teal-700">Sign In →</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}

/* ── Data ── */

const HOOKS = [
  {
    icon: Zap,
    title: 'Live in 5 minutes.',
    body: 'Create your first work order before your coffee’s cold.',
  },
  {
    icon: Smartphone,
    title: 'No App Store, no downloads.',
    body: 'Everything runs in the browser as an installable web app.',
  },
  {
    icon: KeyRound,
    title: 'Passwordless for everyone.',
    body: 'Tenants and contractors get a magic link, not another password to forget.',
  },
] as const;

const AUDIENCES = [
  {
    role: 'Landlords',
    icon: Building2,
    body: 'Stop chasing contractors and losing track of requests. See every work order in one place, from your phone — with an email the moment status changes.',
  },
  {
    role: 'Tenants',
    icon: UserCheck,
    body: 'Report a problem in seconds. Tap a link, describe the issue, done — no app, no account.',
  },
  {
    role: 'Contractors',
    icon: Wrench,
    body: 'A dead-simple mobile job queue. Get the work, mark it done, get paid — no login hassle.',
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
