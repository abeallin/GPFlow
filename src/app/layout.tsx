'use client';

import './globals.css';
import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/AppShell';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/') {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <AppShell pathname={pathname}>{children}</AppShell>
      </body>
    </html>
  );
}
