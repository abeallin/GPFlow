'use client';

import './globals.css';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Database, FileText, Play, Settings, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogoFull } from '@/components/ui/Logo';

const navItems = [
  { href: '/data', label: 'Data', icon: Database },
  { href: '/templates', label: 'Templates', icon: FileText },
  { href: '/runs', label: 'Runs', icon: Play },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  if (pathname === '/') {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className="min-h-screen flex bg-bg-root">
        {/* Sidebar */}
        <motion.nav
          animate={{ width: collapsed ? 64 : 256 }}
          transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="bg-sidebar flex flex-col shrink-0 border-r border-border-subtle relative overflow-hidden"
        >
          {/* Frosted glass sheen */}
          <div className="absolute inset-0 backdrop-blur-sm bg-[#090B12]/80 pointer-events-none" />

          {/* Logo + collapse toggle */}
          <div className="relative z-10 px-3 py-5 border-b border-border flex items-center justify-between min-h-[68px]">
            <AnimatePresence mode="wait">
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="pl-2"
                >
                  <LogoFull size="md" showSubtitle subtitleText="Desktop" />
                </motion.div>
              )}
            </AnimatePresence>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 rounded-lg text-text-muted hover:text-text-secondary hover:bg-sidebar-hover transition-all duration-200 shrink-0"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Nav Items */}
          <div className="relative z-10 flex-1 px-2 py-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`group relative flex items-center rounded-lg text-sm font-medium transition-all duration-200
                    ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'}
                    ${active
                      ? 'text-text-primary bg-[var(--sidebar-active)]'
                      : 'text-text-muted hover:text-text-secondary hover:bg-sidebar-hover'
                    }`}
                >
                  {/* Active left accent bar */}
                  {active && (
                    <motion.div
                      layoutId="nav-active"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-accent"
                      style={{ boxShadow: '0 0 12px rgba(16, 224, 160, 0.5)' }}
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                  <Icon className={`w-[18px] h-[18px] shrink-0 transition-colors duration-200 ${active ? 'text-accent' : ''}`} />
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Bottom */}
          <div className="relative z-10 px-2 py-4 border-t border-border">
            <div className={`flex items-center text-text-muted ${collapsed ? 'justify-center px-0 py-2' : 'gap-3 px-3 py-2'}`}>
              <Settings className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="text-xs font-mono">v8.0.0</span>}
            </div>
          </div>
        </motion.nav>

        {/* Main content */}
        <main className="flex-1 overflow-auto bg-bg-base relative noise-overlay">
          <div className="relative z-10 min-h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="min-h-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </body>
    </html>
  );
}
