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
    path: '/printer-incidents',
    label: 'Printer Toner',
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
    path: '/admin',
    label: 'Administration',
    icon: <Settings className="w-5 h-5" />
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
      className="fixed top-20 left-0 bottom-0 z-50 w-64 bg-gradient-to-b from-sidebar-primary to-sidebar-primary dark:from-sidebar dark:to-sidebar-accent overflow-y-auto shadow-2xl transition-colors duration-300 overflow-hidden transform-gpu"
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
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent" />
      <nav className="p-4 space-y-1">
        {visibleItems.map((item, index) => (
          <motion.div
            key={item.path}
            initial={shouldReduceMotion ? false : { opacity: 0, x: -8 }}
            animate={shouldReduceMotion ? { opacity: 1, x: 0 } : { opacity: 1, x: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: 'easeOut', delay: Math.min(index * 0.01, 0.08) }}
          >
            <Link
              to={item.path}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 group relative
                ${
                  isActive(item.path)
                    ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm'
                    : 'text-blue-100 dark:text-gray-400 hover:bg-white/10 dark:hover:bg-white/5 hover:text-white'
                }
              `}
            >
              {/* Icon with animation */}
              <motion.div
                whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
                transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 22 }}
              >
                {item.icon}
              </motion.div>
              
              <span className="font-medium">{item.label}</span>
              
              {item.children && (
                <ChevronRight className={`w-4 h-4 ml-auto ${isActive(item.path) ? 'text-white' : 'text-blue-300 dark:text-gray-500'}`} />
              )}
              
              {/* Active indicator */}
              {isActive(item.path) && (
                <motion.div
                  className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full"
                  layoutId="activeIndicator"
                  transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 30 }}
                />
              )}
            </Link>
          </motion.div>
        ))}
      </nav>
    </motion.aside>
  );
}