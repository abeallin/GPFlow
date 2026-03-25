'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Database, FileText, Play, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { href: '/data', label: 'Data', icon: Database },
  { href: '/templates', label: 'Templates', icon: FileText },
  { href: '/runs', label: 'Runs', icon: Play },
];

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
      <body className="min-h-screen flex bg-gradient-to-br from-slate-50 to-gray-100">
        <nav className="w-64 bg-sidebar flex flex-col shrink-0">
          {/* Logo */}
          <div className="px-6 py-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-white text-sm font-bold">GP</span>
              </div>
              <div>
                <h1 className="text-base font-bold text-white">GP Flow</h1>
                <p className="text-[10px] text-text-on-dark/40 uppercase tracking-widest">Desktop</p>
              </div>
            </div>
          </div>

          {/* Nav Items */}
          <div className="flex-1 px-3 py-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                    ${active
                      ? 'bg-[var(--sidebar-active)] text-white border-l-2 border-primary ml-0'
                      : 'text-text-on-dark/60 hover:bg-sidebar-hover hover:text-text-on-dark'
                    }`}
                >
                  <Icon className="w-[18px] h-[18px]" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Bottom */}
          <div className="px-3 py-4 border-t border-white/10">
            <div className="flex items-center gap-3 px-3 py-2 text-text-on-dark/40">
              <Settings className="w-4 h-4" />
              <span className="text-xs">v8.0.0</span>
            </div>
          </div>
        </nav>

        <main className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="min-h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </body>
    </html>
  );
}
