import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Nestora collects, uses, and protects your information.',
};

const LAST_UPDATED = 'June 25, 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-semibold tracking-tight text-gray-900">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-gray-600">{children}</div>
    </section>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
      <span>{children}</span>
    </li>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 antialiased">
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/">
            <Image src="/nestora-logo.svg" alt="Nestora" width={100} height={25} priority />
          </Link>
          <Link
            href="/sign-in"
            className="rounded-lg border border-teal-200 bg-white px-4 py-1.5 text-sm font-medium text-teal-700 shadow-sm transition-colors hover:bg-teal-50"
          >
            Sign In
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="mb-2 text-sm font-medium text-teal-700">Legal</p>
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mb-12 text-sm text-gray-400">Last updated: {LAST_UPDATED}</p>

        <p className="mb-10 text-sm leading-relaxed text-gray-600">
          Nestora (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates the
          gonestora.app platform and its associated mobile app (the &ldquo;Service&rdquo;). This
          Privacy Policy explains what information we collect, how we use it, and your rights
          regarding that information.
        </p>

        <Section title="1. Information We Collect">
          <p className="font-medium text-gray-700">Information you provide directly</p>
          <ul className="space-y-2">
            <Li><strong>Account information</strong> — name, email address, and password when you register.</Li>
            <Li><strong>Profile information</strong> — phone number and emergency contact details you add to your profile.</Li>
            <Li><strong>Property information</strong> — property names, addresses, and unit details entered by landlords.</Li>
            <Li><strong>Maintenance requests</strong> — descriptions, categories, and photos you upload when submitting or managing a request.</Li>
            <Li><strong>Communications</strong> — messages or notes added to work orders and requests.</Li>
          </ul>
          <p className="font-medium text-gray-700">Information collected automatically</p>
          <ul className="space-y-2">
            <Li><strong>Usage data</strong> — pages visited, features used, and actions taken within the app.</Li>
            <Li><strong>Device information</strong> — browser type, operating system, and device identifiers.</Li>
            <Li><strong>Log data</strong> — IP address, timestamps, and error reports.</Li>
          </ul>
        </Section>

        <Section title="2. How We Use Your Information">
          <p>We use the information we collect to:</p>
          <ul className="space-y-2">
            <Li>Provide, operate, and maintain the Service</Li>
            <Li>Connect landlords, tenants, and contractors within the platform</Li>
            <Li>Send transactional emails (invite links, work order notifications, status updates)</Li>
            <Li>Respond to support requests</Li>
            <Li>Monitor and improve the reliability and performance of the Service</Li>
            <Li>Comply with legal obligations</Li>
          </ul>
          <p>We do not sell your personal information to third parties.</p>
        </Section>

        <Section title="3. Information Sharing">
          <p>We share information only as necessary to operate the Service or as required by law:</p>
          <ul className="space-y-2">
            <Li>
              <span><strong>Within your organization</strong> — landlords can see tenant and contractor profile information for properties they manage. Tenants can see the status of their own requests. Contractors can see work order details assigned to them.</span>
            </Li>
            <Li>
              <span><strong>Service providers</strong> — we use Supabase for authentication and database hosting, and Vercel for application hosting. These providers process data on our behalf under their own privacy and security commitments.</span>
            </Li>
            <Li>
              <span><strong>Legal requirements</strong> — we may disclose information if required by law, court order, or to protect the rights and safety of our users.</span>
            </Li>
          </ul>
        </Section>

        <Section title="4. Data Retention">
          <p>
            We retain your data for as long as your account is active. If you close your account,
            we will delete or anonymize your personal information within 30 days, except where we
            are required to retain it for legal or compliance purposes.
          </p>
        </Section>

        <Section title="5. Security">
          <p>
            We use industry-standard security measures including encrypted connections (HTTPS),
            secure authentication tokens, and row-level security on our database. No method of
            transmission over the internet is 100% secure, but we take reasonable steps to protect
            your information.
          </p>
        </Section>

        <Section title="6. Your Rights">
          <p>Depending on your location, you may have the right to:</p>
          <ul className="space-y-2">
            <Li>Access the personal information we hold about you</Li>
            <Li>Correct inaccurate information</Li>
            <Li>Request deletion of your information</Li>
            <Li>Object to or restrict certain processing</Li>
            <Li>Export your data in a portable format</Li>
          </ul>
          <p>
            To exercise any of these rights, email us at{' '}
            <a href="mailto:hello@gonestora.app" className="text-teal-700 hover:underline">
              hello@gonestora.app
            </a>.
          </p>
        </Section>

        <Section title="7. Cookies">
          <p>
            We use essential cookies to maintain your session and remember your authentication
            state. We do not use tracking or advertising cookies.
          </p>
        </Section>

        <Section title="8. Children&rsquo;s Privacy">
          <p>
            The Service is not directed at children under 13. We do not knowingly collect personal
            information from anyone under 13. If you believe we have inadvertently done so, contact
            us and we will delete it promptly.
          </p>
        </Section>

        <Section title="9. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. We will notify you of material
            changes by posting the updated policy on this page with a revised &ldquo;Last
            updated&rdquo; date. Continued use of the Service after changes constitutes acceptance
            of the updated policy.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>
            Questions about this Privacy Policy? Reach us at{' '}
            <a href="mailto:hello@gonestora.app" className="text-teal-700 hover:underline">
              hello@gonestora.app
            </a>.
          </p>
        </Section>
      </main>

      <footer className="border-t border-gray-100 bg-white py-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-3 px-4 text-xs text-gray-400 sm:flex-row sm:px-6">
          <span className="font-semibold text-teal-700">Nestora</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="transition-colors hover:text-teal-700">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-teal-700">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
