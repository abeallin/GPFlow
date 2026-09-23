'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Database, FileText, Play, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { LogoFull } from '@/components/ui/Logo';
import { ToastStack } from '@/components/ui/Toast';
import { LiveAnnouncer } from '@/components/ui/LiveAnnouncer';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';

const navItems = [
  { href: '/data', label: 'Data', icon: Database },
  { href: '/templates', label: 'Templates', icon: FileText },
  { href: '/runs', label: 'Runs', icon: Play },
];

/**
 * The signed-in chrome: skip link, sidebar, a main region that can take focus,
 * and the single toast stack + live regions (docs/ui-rules.md §7–8).
 */
export function AppShell({ pathname, children }: { pathname: string; children: ReactNode }) {
  const router = useRouter();
  const mainRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('sidebar_collapsed') === 'true') setCollapsed(true);
    } catch { /* storage unavailable */ }
    setIsElectron(!!window.electronAPI);
  }, []);

  const toggleCollapsed = (value: boolean) => {
    setCollapsed(value);
    try { localStorage.setItem('sidebar_collapsed', String(value)); } catch { /* ignore */ }
  };

  const handleLogout = () => {
    // Clear session data but keep accounts and credentials
    localStorage.removeItem('gpflow_practices');
    localStorage.removeItem('gpflow_assignments');
    localStorage.removeItem('gpflow_uploaded_files');
    sessionStorage.clear();
    router.push('/');
  };

  const skipToMain = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    mainRef.current?.focus();
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-bg-base text-text-primary">
      <a
        href="#main"
        onClick={skipToMain}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[300] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-text-on-accent"
      >
        Skip to main content
      </a>

      <nav
        aria-label="Primary"
        style={{ width: collapsed ? 64 : 256 }}
        className="bg-sidebar flex flex-col shrink-0 border-r border-border-subtle relative transition-[width] duration-250 ease-out motion-reduce:transition-none"
      >
        {/* Logo + collapse toggle — draggable for custom titlebar */}
        <div className="relative z-10 px-3 pt-9 pb-5 border-b border-border flex items-center justify-between min-h-[68px] drag-region">
          {!collapsed && (
            <div className="pl-2">
              <LogoFull size="md" showSubtitle subtitleText={isElectron ? 'Desktop' : 'Web'} />
            </div>
          )}
          <button
            type="button"
            onClick={() => toggleCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            className="min-w-9 min-h-9 inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-sidebar-hover transition-colors duration-150 shrink-0 no-drag"
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" aria-hidden="true" /> : <PanelLeftClose className="w-4 h-4" aria-hidden="true" />}
          </button>
        </div>

        <ul className="relative z-10 flex-1 px-2 py-4 space-y-1 list-none m-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  className={`group relative flex items-center min-h-10 rounded-lg text-sm font-medium transition-colors duration-150
                    ${collapsed ? 'justify-center px-0' : 'gap-3 px-3'}
                    ${active
                      ? 'text-text-primary bg-[var(--sidebar-active)]'
                      : 'text-text-secondary hover:text-text-primary hover:bg-sidebar-hover'
                    }`}
                >
                  {active && (
                    <span aria-hidden="true" className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-accent" />
                  )}
                  <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-accent' : ''}`} aria-hidden="true" />
                  {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="relative z-10 px-2 py-3 border-t border-border space-y-1">
          {!collapsed && (
            <div className="px-3 py-1">
              <span className="text-[11px] font-mono text-text-muted">v{APP_VERSION}</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            aria-label={collapsed ? 'Log out' : undefined}
            className={`flex items-center min-h-10 rounded-lg text-sm font-medium text-text-secondary hover:text-error-text hover:bg-error-light transition-colors duration-150 w-full no-drag
              ${collapsed ? 'justify-center px-0' : 'gap-3 px-3'}`}
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
            {!collapsed && <span>Log out</span>}
          </button>
        </div>
      </nav>

      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-bg-base relative outline-none"
      >
        {/* Titlebar drag region for main area */}
        <div className="h-9 drag-region shrink-0 bg-bg-base sticky top-0 z-50" />
        <div key={pathname} className="relative z-10 min-h-full animate-[fade-in_250ms_ease-out] motion-reduce:animate-none">
          {children}
        </div>
      </main>

      <ToastStack />
      <LiveAnnouncer />
    </div>
  );
}
