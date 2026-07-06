import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ClipboardList, Plus, ShieldCheck, Smartphone } from 'lucide-react';
import { MaintenanceRequestToolClient } from './maintenance-request-tool-client';

export const metadata = {
  title: 'Free Maintenance Request Form Template',
  description:
    'Free maintenance request form for landlords and tenants. Generate a printable, editable PDF or a shareable link — no app or account required.',
  alternates: {
    canonical: 'https://gonestora.app/tools/maintenance-request-form',
  },
  openGraph: {
    title: 'Free Maintenance Request Form Template | Nestora',
    description:
      'Generate a printable, editable maintenance request form in seconds. Download a PDF or share a link — no app or account needed for your tenant.',
    url: 'https://gonestora.app/tools/maintenance-request-form',
    siteName: 'Nestora',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Maintenance Request Form Template | Nestora',
    description:
      'Generate a printable, editable maintenance request form in seconds. Download a PDF or share a link — no app or account needed for your tenant.',
  },
};

const FAQS = [
  {
    q: 'Is this maintenance request form template really free?',
    a: 'Yes. There’s no signup, no account, and no cost to use the builder, download a PDF, or share the link with a tenant.',
  },
  {
    q: 'Can I edit the form or use it as a printable template?',
    a: 'Yes — every field updates the live preview as you type, so you can treat it as an editable template. When you’re happy with it, use Download PDF to get a clean, printable version.',
  },
  {
    q: 'What should a tenant include in a maintenance request?',
    a: 'A useful tenant maintenance request form covers the issue category (plumbing, electrical, HVAC, appliance, structural, pest, or other), how urgent it is, a clear description, a photo if possible, and times someone can access the unit — that’s exactly what this tool asks for.',
  },
  {
    q: 'Do tenants need to download an app or create an account?',
    a: 'No. The shareable link opens directly in a browser. There’s nothing to install and nothing to sign up for.',
  },
] as const;

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: f.a,
    },
  })),
};

export default function MaintenanceRequestFormPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
          <Link href="/landing" className="shrink-0">
            <Image
              src="/nestora-logo.svg"
              alt="Nestora"
              width={120}
              height={30}
              priority
              className="w-[92px] shrink-0 sm:w-[120px]"
              style={{ height: 'auto' }}
            />
          </Link>
          <Link
            href="/sign-in"
            className="shrink-0 rounded-lg border border-teal-200 bg-white px-2.5 py-1 text-xs font-medium whitespace-nowrap text-teal-700 shadow-sm transition-colors hover:bg-teal-50 sm:px-4 sm:py-1.5 sm:text-sm"
          >
            Try Nestora free
          </Link>
        </div>
      </header>

      {/* ── Hero / intro ── */}
      <section className="mx-auto max-w-3xl px-4 pt-12 pb-6 sm:px-6 sm:pt-16 print:hidden">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Free Maintenance Request Form Template
        </h1>
        <p className="mt-4 text-base leading-relaxed text-gray-600 sm:text-lg">
          A maintenance request form is the simplest way for a tenant to tell their landlord exactly
          what&rsquo;s wrong — and for a landlord to have everything needed to fix it, in writing,
          the first time. Instead of a string of texts or a rushed phone call, a good maintenance
          request form captures the essentials up front: what the issue is, how urgent it is, when
          someone can access the unit, and often a photo of the problem itself.
        </p>
        <p className="mt-4 text-base leading-relaxed text-gray-600 sm:text-lg">
          Landlords use a standardized form for a few reasons: it creates a paper trail useful for
          insurance and for coordinating with a contractor, and it saves time — a tenant who fills
          in category, urgency, and access times gives a landlord everything needed to triage the
          job, instead of five follow-up questions.
        </p>
        <p className="mt-4 text-base leading-relaxed text-gray-600 sm:text-lg">
          The tool below is a free, printable, and fully editable maintenance request form template.
          Fill in your property details and it generates a clean{' '}
          <strong className="font-semibold text-gray-900">tenant maintenance request form</strong>{' '}
          you can download as a PDF, print, or share as a link — no signup, no app, and no account
          required for your tenant to use it.
        </p>
      </section>

      {/* ── Soft context line above the tool ── */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 print:hidden">
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-gray-500">
          This is the free, one-off version.{' '}
          <Link
            href="/landing"
            className="font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800"
          >
            Nestora
          </Link>{' '}
          does this automatically — with photo intake, contractor dispatch, and status tracking
          built in.
        </div>
      </div>

      {/* ── The tool ── */}
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <MaintenanceRequestToolClient />
      </section>

      {/* ── Tenant-facing explainer ── */}
      <section className="bg-slate-50 py-16 print:hidden">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="mb-3 text-2xl font-bold tracking-tight text-teal-700 sm:text-3xl">
            Tenant maintenance request form
          </h2>
          <p className="text-base leading-relaxed text-gray-600 sm:text-lg">
            When a tenant opens your shared link, they see a tenant maintenance request form
            pre-filled with your property name — no login, no app to download. They pick an issue
            category (plumbing, electrical, HVAC, appliance, structural, pest, or other), flag how
            urgent it is, describe the problem, attach a photo, and note when it&rsquo;s okay for
            someone to access the unit. That&rsquo;s the same information a contractor needs to
            quote the job correctly the first time.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <ClipboardList className="mb-2 h-5 w-5 text-teal-700" />
              <p className="text-sm font-semibold text-gray-900">Structured, not a text thread</p>
              <p className="mt-1 text-sm text-gray-500">
                Category, urgency, and access times captured every time.
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <Smartphone className="mb-2 h-5 w-5 text-teal-700" />
              <p className="text-sm font-semibold text-gray-900">No app, no account</p>
              <p className="mt-1 text-sm text-gray-500">
                Opens in any browser. Nothing to install.
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <ShieldCheck className="mb-2 h-5 w-5 text-teal-700" />
              <p className="text-sm font-semibold text-gray-900">A written record</p>
              <p className="mt-1 text-sm text-gray-500">
                Useful for insurance and for settling disputes later.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-16 print:hidden">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="mb-8 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Frequently asked questions
          </h2>
          <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white shadow-sm">
            {FAQS.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-gray-900">
                  {f.q}
                  <Plus className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-45" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="bg-teal-900 py-20 print:hidden">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Ready to stop copy-pasting requests into spreadsheets?
          </h2>
          <p className="mt-3 text-teal-200">
            Nestora turns this form into a real work order automatically — with photo intake,
            contractor dispatch, and status tracking. Your first work order is live in under 5
            minutes.
          </p>
          <p className="mt-6 text-xs text-teal-300">
            Built by a landlord who got tired of tracking repairs in text threads.
          </p>
          <div className="mt-4">
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-teal-900 shadow-sm transition-colors hover:bg-teal-50"
            >
              Try Nestora free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 bg-white py-8 print:hidden">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-gray-400 sm:flex-row sm:px-6">
          <span className="font-semibold text-teal-700">Nestora</span>
          <div className="flex items-center gap-4">
            <Link href="/landing" className="transition-colors hover:text-teal-700">
              Home
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-teal-700">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-teal-700">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
