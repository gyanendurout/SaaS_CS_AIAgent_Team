import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { SupabaseProvider } from '@/providers/SupabaseProvider';
import { DemoHeader } from '@/components/DemoHeader';
import './globals.css';

export const metadata: Metadata = {
  title: 'JOOLA Customer Support',
  description:
    'Talk, write, or fill out a form — JOOLA Customer Support is here for warranties, returns, and product questions.',
  applicationName: 'JOOLA Customer Support',
  icons: { icon: '/favicon.ico' },
};

export const viewport: Viewport = {
  themeColor: '#F5F4F1',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-joola-paper font-sans text-joola-ink antialiased">
        <SupabaseProvider>
          <DemoHeader />
          {children}
        </SupabaseProvider>
      </body>
    </html>
  );
}
