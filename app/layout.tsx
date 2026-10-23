import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Vidyareel', description: 'Educator video generator' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
