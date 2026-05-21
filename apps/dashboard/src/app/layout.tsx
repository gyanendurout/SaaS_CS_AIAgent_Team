import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ReactQueryProvider } from '@/providers/ReactQueryProvider';
import { SupabaseProvider } from '@/providers/SupabaseProvider';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'JOOLA · CS Command',
  description:
    'Live operations dashboard for the JOOLA Warranty AI system. CS Lead view: agents, calls, escalations, archive.',
};

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
  width: 1440,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <ReactQueryProvider>
          <SupabaseProvider>
            <ToastProvider>{children}</ToastProvider>
          </SupabaseProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
