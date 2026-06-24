import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { MobileFocusHandler } from '@/app/components/mobile-focus-handler';
import { ServiceWorkerRegistration } from '@/app/components/service-worker-registration';
import { SplashDismisser } from '@/components/splash-dismisser';
import './globals.css';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/counter.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
});

export const viewport: Viewport = {
  themeColor: '#0F766E',
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: {
    default: 'Nestora',
    template: '%s | Nestora',
  },
  description: 'Property maintenance made simple for small landlords.',
  applicationName: 'Nestora',
  appleWebApp: {
    capable: true,
    title: 'Nestora',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="bg-white text-foreground h-full">
        <div
          id="nestora-splash"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ffffff',
          }}
        >
          <svg viewBox="0 0 120 120" width="72" height="72" fill="none" aria-hidden="true">
            <style>{`
              @keyframes nestora-draw { to { stroke-dashoffset: 0; } }
              #sp-roof {
                stroke-dasharray: 1; stroke-dashoffset: 1;
                animation: nestora-draw 0.65s cubic-bezier(.25,.46,.45,.94) 0s both;
              }
              #sp-left {
                stroke-dasharray: 1; stroke-dashoffset: 1;
                animation: nestora-draw 0.45s cubic-bezier(.25,.46,.45,.94) 0.38s both;
              }
              #sp-right {
                stroke-dasharray: 1; stroke-dashoffset: 1;
                animation: nestora-draw 0.45s cubic-bezier(.25,.46,.45,.94) 0.5s both;
              }
              #sp-diag {
                stroke-dasharray: 1; stroke-dashoffset: 1;
                animation: nestora-draw 0.5s cubic-bezier(.25,.46,.45,.94) 0.68s both;
              }
            `}</style>
            <path id="sp-roof" d="M20 42 L60 18 L100 42"
              stroke="#F2B069" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
            <path id="sp-left" d="M30.5 40 L30.5 104"
              stroke="#0F766E" strokeWidth="17" strokeLinecap="butt" pathLength="1" />
            <path id="sp-right" d="M89.5 40 L89.5 104"
              stroke="#0F766E" strokeWidth="17" strokeLinecap="butt" pathLength="1" />
            <path id="sp-diag" d="M31 46 L88 99"
              stroke="#0F766E" strokeWidth="17" strokeLinecap="round" pathLength="1" />
          </svg>
        </div>
        <SplashDismisser />
        {children}
        <Toaster position="top-right" richColors />
        <MobileFocusHandler />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
