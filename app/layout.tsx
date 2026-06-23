import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { MobileFocusHandler } from '@/app/components/mobile-focus-handler';
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
      <body className="bg-background text-foreground h-full">
        {children}
        <Toaster position="top-right" richColors />
        <MobileFocusHandler />
      </body>
    </html>
  );
}
