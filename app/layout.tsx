import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { MobileFocusHandler } from '@/app/components/mobile-focus-handler';
import { ServiceWorkerRegistration } from '@/app/components/service-worker-registration';
import { StandaloneDetector } from '@/app/components/standalone-detector';
import { AppMountedMarker } from '@/components/app-mounted-marker';
import { SplashScreen } from '@/components/splash-screen';
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
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://gonestora.app'),
  verification: {
    google: 'otfT_JZvLEOaE6rN6jZFvgKl7iLc7xnqq9zYQ_APlDg',
  },
  title: {
    default: 'Nestora',
    template: '%s | Nestora',
  },
  description: 'Property maintenance made simple for small landlords.',
  applicationName: 'Nestora',
  appleWebApp: {
    capable: true,
    title: 'Nestora',
    statusBarStyle: 'black-translucent',
  },
  // Next.js's appleWebApp.capable only emits the modern unprefixed
  // `mobile-web-app-capable` tag. iOS's own splash-screen / standalone-mode
  // detection has long relied specifically on the apple-prefixed tag, so we
  // set it explicitly rather than depending on iOS falling back to the
  // unprefixed one.
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
  icons: {
    icon: [
      { url: '/icons/icon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-180.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/icons/icon-192.png',
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
      <body className="bg-background text-foreground h-full">
        <SplashScreen />
        {children}
        <Toaster position="top-right" richColors />
        <MobileFocusHandler />
        <ServiceWorkerRegistration />
        <StandaloneDetector />
        <AppMountedMarker />
      </body>
    </html>
  );
}
