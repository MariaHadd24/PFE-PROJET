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
      className="min-h-screen relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-[#0F172A] dark:via-[#0F172A] dark:to-[#0F172A] transition-colors duration-300"
      style={{ ['--sidebar-w' as any]: sidebarOpen ? '16rem' : '0rem' }}
    >
      {/* Ambient background (purely decorative) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute top-48 -left-24 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute bottom-24 right-32 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>
      <Navbar sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
      <Sidebar isOpen={sidebarOpen} />
      <main
        className="mt-20 p-8 transition-[padding] duration-300"
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