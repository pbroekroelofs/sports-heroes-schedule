import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import NavBar from '@/components/NavBar';
import InstallPrompt from '@/components/InstallPrompt';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Sports Heroes Schedule',
  description: 'Your personal sports event schedule — F1, Ajax, MvdP and more',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Schedule',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={`${inter.className} h-full`}>
        <Providers>
          <div className="flex flex-col min-h-screen">
            <NavBar />
            <main className="flex-1 overflow-y-auto scroll-smooth-ios">{children}</main>
          </div>
          <InstallPrompt />
        </Providers>
      </body>
    </html>
  );
}
