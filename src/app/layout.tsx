import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/components/ui/Toast';
import Navbar from '@/components/ui/Navbar';
import Footer from '@/components/ui/Footer';
import AuthModal from '@/components/auth/AuthModal';
import AuthCodeRedirect from '@/components/ui/AuthCodeRedirect';
import CommunityModal from '@/components/ui/CommunityModal';
import SecurityProtection from '@/components/ui/SecurityProtection';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#050508',
};

export const metadata: Metadata = {
  title: {
    default: 'DubLK - Sinhala Dubbed Movies',
    template: '%s | DubLK',
  },
  description: 'Watch your favorite Hollywood movies dubbed in Sinhala. Sri Lanka\'s premier Sinhala dubbed movie streaming platform.',
  keywords: ['sinhala dubbed movies', 'sinhala movies', 'dubbed movies sri lanka', 'watch movies sinhala', 'DubLK'],
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/favicon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'DubLK',
    title: 'DubLK - Sinhala Dubbed Movies',
    description: 'Watch your favorite Hollywood movies dubbed in Sinhala.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DubLK - Sinhala Dubbed Movies',
    description: 'Watch your favorite Hollywood movies dubbed in Sinhala.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col">
        <ToastProvider>
          <AuthProvider>
            <Suspense fallback={null}>
              <AuthCodeRedirect />
            </Suspense>
            <Navbar />
            <AuthModal />
            <CommunityModal />
            <SecurityProtection />
            <main className="flex-1 pb-20 md:pb-0">
              {children}
            </main>
            <Footer />
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
