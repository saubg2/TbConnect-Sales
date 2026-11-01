import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Relationship Agent SaaS (Phase 0 Dev)',
  description: 'Email-first, multi-tenant AI relationship manager',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
