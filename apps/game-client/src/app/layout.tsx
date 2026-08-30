import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/vazirmatn/wght.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Crown & Coin',
  description: 'A mobile-first strategy game foundation.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#12100d',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html dir="ltr" lang="en">
      <body>{children}</body>
    </html>
  );
}
