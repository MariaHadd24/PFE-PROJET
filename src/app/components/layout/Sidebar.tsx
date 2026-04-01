import React from 'react';
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
    path: '/admin',
    label: 'Administration',
    icon: <Settings className="w-5 h-5" />
  },
  {
    path: '/audit-logs',
    label: 'Audit Logs',
    icon: <ClipboardList className="w-5 h-5" />
  }
];

export function Sidebar({ isOpen }: { isOpen: boolean }) {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();
  const { user } = useAuth();

  const role = user?.role ?? 'Reader';

  const visibleItems = navItems.filter((item) => {
    const path = item.path.replace(/^\//, '');
    return canAccessPage(role, path as any);
  });

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  return (
    <motion.aside
      className={
        [
          'fixed top-20 left-0 bottom-0 z-50 w-64 overflow-hidden transform-gpu',
          // Premium glass surface (uses existing theme.css .glass)
          'glass backdrop-blur-2xl',
          'border-r border-sidebar-border/55',
          // Darker blue in light mode
          'bg-sidebar-primary/92 text-sidebar-primary-foreground',
          'dark:bg-sidebar/60 dark:text-sidebar-foreground',
          'ring-1 ring-white/12',
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
        {/* Glass highlights + animated sheen */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/14 via-white/0 to-black/22 dark:from-white/7 dark:to-black/45" />
        <div
          className={"absolute inset-0 opacity-80 " + (shouldReduceMotion ? '' : 'animate-gradient')}
          style={{
            backgroundImage:
              'linear-gradient(135deg, color-mix(in oklch, var(--sidebar-primary-foreground) 18%, transparent), transparent 55%, color-mix(in oklch, var(--primary) 18%, transparent))',
          }}
        />
        <div
          className="absolute inset-0 opacity-18"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, color-mix(in oklch, var(--sidebar-primary-foreground) 14%, transparent) 1px, transparent 0)',
            backgroundSize: '12px 12px',
          }}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-white/20 via-white/0 to-white/12 opacity-80" />
        {/* Blue WOW glow */}
        <div className={"absolute -top-28 left-[-9rem] h-80 w-80 rounded-full bg-primary/30 blur-3xl " + (shouldReduceMotion ? '' : 'animate-float-slower')} />
        <div className={"absolute -bottom-24 right-[-6rem] h-72 w-72 rounded-full bg-primary/18 blur-3xl " + (shouldReduceMotion ? '' : 'animate-float-slow')} />
        <div className="absolute -top-24 -right-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-black/10 blur-3xl dark:bg-black/20" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 via-transparent to-transparent dark:from-black/40" />
      </div>

      <nav
        className={
          [
            'relative flex h-full flex-col gap-1.5 p-3 pb-3 overflow-hidden',
            '[@media(max-height:760px)]:p-2 [@media(max-height:760px)]:gap-1',
            '[@media(max-height:690px)]:p-2 [@media(max-height:690px)]:gap-0.5',
          ].join(' ')
        }
      >
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
                  'transition-[background-color,box-shadow,transform] duration-200 ease-out',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35',
                  active
                    ? 'bg-white/18 shadow-lg ring-1 ring-white/26 backdrop-blur-md'
                    : 'opacity-90 hover:opacity-100 hover:bg-white/14 hover:ring-1 hover:ring-white/16 hover:shadow-md dark:hover:bg-sidebar-accent/80 hover:translate-x-[1px]',
                ].join(' ')
              }
            >
              {/* Stronger active surface */}
              {active ? (
                <span
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-90"
                  style={{
                    backgroundImage:
                      'linear-gradient(135deg, color-mix(in oklch, var(--sidebar-primary-foreground) 14%, transparent), transparent 45%, color-mix(in oklch, var(--primary) 22%, transparent))',
                  }}
                  aria-hidden
                />
              ) : null}

              <span
                className={
                  [
                    'pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-200 ease-out',
                    active ? 'opacity-100' : 'group-hover:opacity-100',
                  ].join(' ')
                }
                style={{
                  backgroundImage:
                    'linear-gradient(120deg, transparent 0%, color-mix(in oklch, var(--sidebar-primary-foreground) 14%, transparent) 45%, transparent 70%)',
                }}
                aria-hidden
              />

              {/* Icon with animation */}
              <motion.div
                whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
                transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 22 }}
                className={
                  [
                    'relative inline-flex h-10 w-10 items-center justify-center rounded-2xl shrink-0',
                    '[@media(max-height:760px)]:h-9 [@media(max-height:760px)]:w-9',
                    '[@media(max-height:690px)]:h-8 [@media(max-height:690px)]:w-8',
                    'ring-1 ring-white/15',
                    active ? 'bg-white/14 shadow-sm' : 'bg-white/8 group-hover:bg-white/12',
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
                  'relative min-w-0 flex-1 truncate font-semibold tracking-wide text-sm leading-none',
                  '[@media(max-height:760px)]:text-xs',
                  '[@media(max-height:690px)]:text-[11px]',
                  active ? 'opacity-100' : 'opacity-95',
                ].join(' ')}
              >
                {item.label}
              </span>
              
              {item.children && (
                <ChevronRight className={`relative w-4 h-4 ml-auto ${active ? 'text-white' : 'opacity-70'}`} />
              )}
              
              {/* Active indicator */}
              {active && (
                <>
                  <motion.div
                    className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-white/95 shadow-[0_0_0_1px_rgba(255,255,255,0.32)]"
                    layoutId="activeIndicator"
                    transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 30 }}
                  />
                  <span
                    className="pointer-events-none absolute -left-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full opacity-70 blur-xl"
                    style={{
                      background:
                        'radial-gradient(circle, color-mix(in oklch, var(--primary) 55%, transparent) 0%, transparent 70%)',
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
      </nav>
    </motion.aside>
  );
}