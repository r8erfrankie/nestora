import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms governing your use of Nestora.',
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

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="mb-12 text-sm text-gray-400">Last updated: {LAST_UPDATED}</p>

        <p className="mb-10 text-sm leading-relaxed text-gray-600">
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the Nestora
          platform at gonestora.app (the &ldquo;Service&rdquo;), operated by Nestora
          (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). By using the Service you
          agree to these Terms. If you do not agree, do not use the Service.
        </p>

        <Section title="1. The Service">
          <p>
            Nestora is a property maintenance management platform that helps landlords, tenants,
            and contractors coordinate maintenance requests and work orders. We provide tools for
            submitting requests, uploading photos, assigning contractors, and tracking progress.
          </p>
        </Section>

        <Section title="2. Accounts">
          <ul className="space-y-2">
            <Li>You must provide accurate information when creating an account.</Li>
            <Li>You are responsible for maintaining the confidentiality of your login credentials.</Li>
            <Li>You are responsible for all activity that occurs under your account.</Li>
            <Li>
              You must notify us immediately at{' '}
              <a href="mailto:hello@gonestora.app" className="text-teal-700 hover:underline">
                hello@gonestora.app
              </a>{' '}
              if you believe your account has been compromised.
            </Li>
            <Li>Accounts are personal and may not be transferred or shared.</Li>
          </ul>
        </Section>

        <Section title="3. Acceptable Use">
          <p>You agree not to:</p>
          <ul className="space-y-2">
            <Li>Use the Service for any unlawful purpose or in violation of any applicable law</Li>
            <Li>Upload content that is abusive, harassing, defamatory, or fraudulent</Li>
            <Li>Attempt to gain unauthorized access to other accounts or systems</Li>
            <Li>Interfere with or disrupt the integrity or performance of the Service</Li>
            <Li>Use automated means to scrape, crawl, or extract data from the Service</Li>
            <Li>Impersonate another person or entity</Li>
          </ul>
        </Section>

        <Section title="4. Content You Upload">
          <p>
            You retain ownership of content you upload to the Service (photos, descriptions, notes).
            By uploading content, you grant us a limited license to store, display, and transmit
            that content as necessary to operate the Service. You represent that you have the right
            to upload any content you submit and that it does not violate any third-party rights.
          </p>
          <p>
            We do not review user-uploaded content proactively. We reserve the right to remove
            content that violates these Terms.
          </p>
        </Section>

        <Section title="5. Landlord Responsibilities">
          <p>
            Landlords who invite tenants and contractors to the platform are responsible for
            ensuring those invitations are sent to the correct individuals and that their use of
            the platform complies with applicable landlord-tenant laws and regulations in their
            jurisdiction.
          </p>
        </Section>

        <Section title="6. Service Availability">
          <p>
            We aim to keep the Service available at all times but do not guarantee uninterrupted
            access. We may temporarily suspend the Service for maintenance, updates, or reasons
            outside our control. We are not liable for any losses resulting from downtime.
          </p>
        </Section>

        <Section title="7. Pricing">
          <p>
            The Service is currently provided free of charge during our early access period. We
            reserve the right to introduce paid plans in the future. We will provide reasonable
            notice before charging existing users.
          </p>
        </Section>

        <Section title="8. Termination">
          <p>
            You may close your account at any time by contacting us at{' '}
            <a href="mailto:hello@gonestora.app" className="text-teal-700 hover:underline">
              hello@gonestora.app
            </a>. We reserve the right to suspend or terminate accounts that violate these Terms,
            with or without notice.
          </p>
        </Section>

        <Section title="9. Disclaimers">
          <p>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
            warranties of any kind, express or implied. We do not warrant that the Service will be
            error-free, secure, or meet your specific requirements. Use of the Service is at your
            own risk.
          </p>
        </Section>

        <Section title="10. Limitation of Liability">
          <p>
            To the fullest extent permitted by law, Nestora shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages, including loss of data, loss
            of revenue, or loss of goodwill, arising from your use of or inability to use the
            Service. Our total liability to you for any claim shall not exceed the amount you paid
            us in the 12 months preceding the claim.
          </p>
        </Section>

        <Section title="11. Changes to These Terms">
          <p>
            We may update these Terms from time to time. We will notify you of material changes by
            posting the updated Terms on this page with a revised &ldquo;Last updated&rdquo; date.
            Continued use of the Service after changes take effect constitutes your acceptance of
            the new Terms.
          </p>
        </Section>

        <Section title="12. Governing Law">
          <p>
            These Terms are governed by the laws of the State of California, without regard to
            conflict of law principles. Any disputes shall be resolved in the courts of California.
          </p>
        </Section>

        <Section title="13. Contact">
          <p>
            Questions about these Terms? Reach us at{' '}
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
