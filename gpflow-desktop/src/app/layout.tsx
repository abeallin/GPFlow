'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/data', label: 'Data' },
  { href: '/templates', label: 'Templates' },
  { href: '/runs', label: 'Runs' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Login page has no nav
  if (pathname === '/') {
    return (
      <html lang="en">
        <body className="bg-gray-50 min-h-screen">{children}</body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen flex">
        <nav className="w-56 bg-white border-r border-gray-200 p-4 space-y-1">
          <div className="px-3 py-4 mb-4">
            <h1 className="text-lg font-bold text-gray-900">GP Flow</h1>
          </div>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === item.href
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <main className="flex-1 overflow-auto">{children}</main>
      </body>
    </html>
  );
}
