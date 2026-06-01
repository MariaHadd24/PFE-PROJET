import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutlet } from 'react-router';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../context/AuthContext';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChatbotWidget } from '../ui/ChatbotWidget';

export function MainLayout() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutlet();
  const shouldReduceMotion = useReducedMotion();

  const sidebarStorageKey = 'leoni-sidebar-open-v1';
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(sidebarStorageKey);
      if (raw === null) return true;
      return raw === '1' || raw.toLowerCase() === 'true';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(sidebarStorageKey, sidebarOpen ? '1' : '0');
    } catch {
      // ignore
    }
  }, [sidebarOpen]);

  const toggleSidebar = useMemo(() => () => setSidebarOpen((v) => !v), []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!isAuthenticated) return;
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: shouldReduceMotion ? 'auto' : 'smooth',
    });
  }, [isAuthenticated, location.pathname, shouldReduceMotion]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div
      className="blueprint-canvas min-h-screen relative overflow-hidden transition-colors duration-300"
      style={{ ['--sidebar-w' as any]: sidebarOpen ? '16rem' : '0rem' }}
    >
      {/* Ambient background (purely decorative) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-36 right-[8%] h-[28rem] w-[28rem] rounded-full border border-primary/18 bg-primary/8 blur-3xl" />
        <div className="absolute top-[26%] -left-28 h-[22rem] w-[22rem] rounded-full border border-amber-500/16 bg-amber-500/8 blur-3xl" />
        <div className="absolute bottom-[8%] right-[16%] h-48 w-[34rem] -rotate-6 rounded-[999px] border border-slate-500/18 bg-slate-500/8 blur-2xl dark:border-slate-300/12 dark:bg-slate-300/6" />
        <div className="absolute top-[14%] left-[28%] h-44 w-44 rotate-45 rounded-3xl border border-white/16 bg-white/6 blur-2xl dark:border-white/10 dark:bg-white/5" />
      </div>
      <Navbar sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
      <Sidebar isOpen={sidebarOpen} />
      <main
        className="mt-20 p-4 sm:p-6 lg:p-8 transition-[padding] duration-300"
        style={{ paddingLeft: 'calc(var(--sidebar-w, 0rem) + 2rem)' }}
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={location.key}
            initial={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 0, y: 10 }
            }
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 1, y: 0 }
            }
            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {outlet}
          </motion.div>
        </AnimatePresence>
      </main>
      <ChatbotWidget />
    </div>
  );
}