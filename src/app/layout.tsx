import type { Metadata, Viewport } from 'next';
import { Archivo, Figtree, Fredoka } from 'next/font/google';
import './globals.css';

// Display: uppercase headings only. Body: everything else. Signature:
// reserved for the member's first name on the confirmation screen — never
// used app-wide (PRD §4.3).
const display = Archivo({ subsets: ['latin'], weight: ['700'], variable: '--font-display' });
const body = Figtree({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body' });
const signature = Fredoka({ subsets: ['latin'], weight: ['600'], variable: '--font-signature' });

export const metadata: Metadata = {
  title: 'ChristTribe Check-In',
  description: 'Welcome desk check-in for returning members',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0E2B5E',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} ${signature.variable} font-sans bg-sky text-ink antialiased`}>
        {children}
      </body>
    </html>
  );
}
