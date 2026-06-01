import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { motion, useReducedMotion } from 'motion/react';
import {
  LayoutDashboard,
  Package,
  AlertTriangle,
  Users,
  ShoppingCart,
  Handshake,
  Wrench,
  ClipboardList,
  BarChart3,
  KeyRound,
  Users as UsersGroup,
  Settings,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { canAccessPage } from '../../lib/rbac';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />
  },
  {
    path: '/stock-inventory',
    label: 'Assets IT',
    icon: <Package className="w-5 h-5" />
  },
  {
    path: '/printer-toner',
    label: 'Consumables',
    icon: <ClipboardList className="w-5 h-5" />
  },
  {
    path: '/printer-incidents',
    label: 'Incidents',
    icon: <AlertTriangle className="w-5 h-5" />
  },
  {
    path: '/assignments',
    label: 'Assignments',
    icon: <Users className="w-5 h-5" />
  },
  {
    path: '/orders',
    label: 'Orders',
    icon: <ShoppingCart className="w-5 h-5" />
  },
  {
    path: '/vendor-portal',
    label: 'Vendor Portal',
    icon: <Handshake className="w-5 h-5" />
  },
  {
    path: '/reporting',
    label: 'Reporting',
    icon: <BarChart3 className="w-5 h-5" />
  },
  {
    path: '/licences',
    label: 'Licences',
    icon: <KeyRound className="w-5 h-5" />
  },
  {
    path: '/pdf-history',
    label: 'PDF History',
    icon: <ClipboardList className="w-5 h-5" />
  },
  {
    path: '/maintenance',
    label: 'Maintenance',
    icon: <Wrench className="w-5 h-5" />
  },
  {
    path: '/audit-logs',
    label: 'Audit Logs',
    icon: <ClipboardList className="w-5 h-5" />
  },
  {
    path: '/sessions',
    label: 'Sessions',
    icon: <UsersGroup className="w-5 h-5" />
  },
  {
    path: '/admin',
    label: 'Administration',
    icon: <Settings className="w-5 h-5" />
  }
];

export function Sidebar({ isOpen }: { isOpen: boolean }) {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();
  const { user } = useAuth();

  const listRef = useRef<HTMLDivElement | null>(null);

  const role = user?.role ?? 'Reader';

  const visibleItems = navItems.filter((item) => {
    const path = item.path.replace(/^\//, '');
    return canAccessPage(role, path as any);
  });

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  useEffect(() => {
    if (!isOpen) return;

    const raf = requestAnimationFrame(() => {
      const container = listRef.current;
      if (!container) return;
      const activeEl = container.querySelector<HTMLElement>('a[aria-current="page"]');
      if (!activeEl) return;

      try {
        activeEl.scrollIntoView({ block: 'nearest', behavior: shouldReduceMotion ? 'auto' : 'smooth' });
      } catch {
        // ignore
      }
    });

    return () => cancelAnimationFrame(raf);
  }, [isOpen, location.pathname, shouldReduceMotion]);

  return (
    <motion.aside
      className={
        [
          'fixed top-20 left-0 bottom-0 z-50 w-64 overflow-hidden will-change-transform',
          'panel-frame rounded-none rounded-r-2xl',
          'border-r border-sidebar-border/65',
          'bg-gradient-to-b from-slate-50 via-blue-50/40 to-cyan-50/30 text-sidebar-primary-foreground',
          'dark:bg-gradient-to-b dark:from-slate-950 dark:via-blue-950/50 dark:to-cyan-950/40 dark:text-sidebar-foreground',
          'shadow-2xl transition-colors duration-300',
        ].join(' ')
      }
      aria-hidden={!isOpen}
      animate={
        shouldReduceMotion
          ? { x: isOpen ? 0 : -320 }
          : { x: isOpen ? 0 : -320 }
      }
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { type: 'spring', stiffness: 260, damping: 30 }
      }
      style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
    >
      {/* Premium accents (decorative) */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-b from-white/8 via-transparent to-blue-900/12 dark:from-blue-400/6 dark:to-cyan-900/20" />
        <div
          className={"absolute inset-0 opacity-40 " + (shouldReduceMotion ? '' : 'animate-gradient')}
          style={{
            backgroundImage:
              'linear-gradient(135deg, color-mix(in oklch, var(--brand-cyan) 14%, transparent), transparent 54%, color-mix(in oklch, var(--brand-electric) 12%, transparent))',
          }}
        />
        <div
          className="absolute inset-0 opacity-18"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, color-mix(in oklch, var(--brand-electric) 10%, transparent) 1px, transparent 0)',
            backgroundSize: '12px 12px',
          }}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent dark:via-blue-400/25" />
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-blue-400/20 via-white/0 to-cyan-400/15 opacity-70 dark:from-blue-400/15 dark:to-cyan-400/10" />
        <div className={"absolute -top-32 left-[-12rem] h-96 w-96 rounded-full bg-blue-400/20 blur-3xl " + (shouldReduceMotion ? '' : 'animate-float-slower')} />
        <div className={"absolute -bottom-28 right-[-8rem] h-80 w-80 rounded-full bg-cyan-400/16 blur-3xl " + (shouldReduceMotion ? '' : 'animate-float-slow')} />
        <div className="absolute -top-28 -right-20 h-64 w-64 rounded-full bg-blue-300/12 blur-3xl dark:bg-blue-400/8" />
        <div className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-black/8 blur-3xl dark:bg-black/15" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/10 via-transparent to-transparent dark:from-black/25" />
      </div>

      <nav
        className={
          [
            'relative flex h-full min-h-0 flex-col gap-1.5 p-3 pb-5 overflow-hidden',
            '[@media(max-height:760px)]:p-2 [@media(max-height:760px)]:gap-1',
            '[@media(max-height:690px)]:p-2 [@media(max-height:690px)]:gap-0.5',
          ].join(' ')
        }
      >
        <div ref={listRef} className="sidebar-scroll min-h-0 flex-1 overflow-y-auto scroll-smooth pr-1">
          {visibleItems.map((item, index) => (
            <motion.div
              key={item.path}
              initial={shouldReduceMotion ? false : { opacity: 0, x: -8 }}
              animate={shouldReduceMotion ? { opacity: 1, x: 0 } : { opacity: 1, x: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: 'easeOut', delay: Math.min(index * 0.01, 0.08) }}
            >
              {(() => {
                const active = isActive(item.path);
                return (
                  <Link
                    to={item.path}
                    aria-current={active ? 'page' : undefined}
                    className={
                      [
                        'group relative flex items-center gap-3 rounded-2xl px-3.5 py-2',
                        '[@media(max-height:760px)]:py-1.5',
                        '[@media(max-height:690px)]:py-1',
                        'transition-[background-color,box-shadow,transform,color] duration-250 ease-out',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50',
                        active
                          ? 'bg-gradient-to-r from-blue-500/28 to-cyan-400/18 shadow-lg ring-1 ring-cyan-300/50 dark:ring-cyan-400/40 backdrop-blur-md hover:from-blue-500/35 hover:to-cyan-400/24'
                          : 'opacity-90 hover:opacity-100 hover:bg-gradient-to-r hover:from-blue-500/16 hover:to-cyan-400/12 hover:ring-1 hover:ring-cyan-300/30 hover:shadow-md dark:hover:bg-blue-600/20 hover:translate-x-0.5',
                      ].join(' ')
                    }
                  >
                    {/* Stronger active surface */}
                    {active ? (
                      <span
                        className="pointer-events-none absolute inset-0 rounded-2xl opacity-100"
                        style={{
                          backgroundImage:
                            'linear-gradient(135deg, color-mix(in oklch, var(--brand-electric) 18%, transparent), transparent 42%, color-mix(in oklch, var(--brand-cyan) 24%, transparent))',
                        }}
                        aria-hidden
                      />
                    ) : null}

                    {/* Icon with animation */}
                    <motion.div
                      whileHover={shouldReduceMotion ? undefined : { scale: 1.08, rotate: 5 }}
                      transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 22 }}
                      className={
                        [
                          'relative inline-flex h-10 w-10 items-center justify-center rounded-2xl shrink-0',
                          '[@media(max-height:760px)]:h-9 [@media(max-height:760px)]:w-9',
                          '[@media(max-height:690px)]:h-8 [@media(max-height:690px)]:w-8',
                          'ring-1 transition-all duration-200',
                          active ? 'bg-gradient-to-br from-cyan-400/35 to-blue-500/25 shadow-lg ring-cyan-300/40 dark:ring-cyan-400/50 text-blue-900 dark:text-cyan-200' : 'bg-gradient-to-br from-blue-500/15 to-cyan-400/10 group-hover:from-blue-500/25 group-hover:to-cyan-400/18 ring-blue-500/20 group-hover:ring-cyan-300/30 text-blue-950 dark:text-blue-300',
                          // normalize inner icon size
                          '[&>svg]:h-5 [&>svg]:w-5 [@media(max-height:760px)]:[&>svg]:h-[18px] [@media(max-height:760px)]:[&>svg]:w-[18px]',
                          '[@media(max-height:690px)]:[&>svg]:h-4 [@media(max-height:690px)]:[&>svg]:w-4',
                        ].join(' ')
                      }
                    >
                      {item.icon}
                    </motion.div>

                    <span
                      className={[
                        'relative min-w-0 flex-1 truncate font-semibold tracking-wide text-sm leading-snug transition-colors duration-200',
                        '[@media(max-height:760px)]:text-xs',
                        '[@media(max-height:690px)]:text-[11px]',
                        active ? 'opacity-100 text-blue-950 dark:text-cyan-100 font-bold' : 'opacity-95 text-blue-900 dark:text-blue-200 group-hover:text-blue-950 dark:group-hover:text-cyan-100',
                      ].join(' ')}
                    >
                      {item.label}
                    </span>

                    {item.children && (
                      <ChevronRight className={`relative w-4 h-4 ml-auto transition-all duration-300 ${active ? 'text-cyan-300 dark:text-cyan-200 opacity-100' : 'text-blue-600/60 dark:text-blue-300/50 opacity-70 group-hover:opacity-100'}`} />
                    )}

                    {/* Active indicator */}
                    {active && (
                      <>
                        <motion.div
                          className="absolute left-0 top-1.5 bottom-1.5 w-1.5 rounded-r-full bg-gradient-to-b from-cyan-300 to-blue-400 shadow-[0_0_12px_3px_rgba(34,197,94,0.3)] dark:shadow-[0_0_12px_3px_rgba(34,211,238,0.25)]"
                          layoutId="activeIndicator"
                          transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 30 }}
                        />
                        <span
                          className="pointer-events-none absolute -left-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full opacity-80 blur-xl"
                          style={{
                            background:
                              'radial-gradient(circle, color-mix(in oklch, var(--brand-cyan) 65%, transparent) 0%, transparent 70%)',
                          }}
                          aria-hidden
                        />
                      </>
                    )}
                  </Link>
                );
              })()}
            </motion.div>
          ))}
        </div>
      </nav>
    </motion.aside>
  );
}