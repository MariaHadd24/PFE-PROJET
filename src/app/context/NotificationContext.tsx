import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from './AuthContext';
import type { UserRole } from '../types';
import { getApiWsUrl } from '../lib/realtime';

export type NotificationCategory =
  | 'request'
  | 'order'
  | 'assignment'
  | 'maintenance'
  | 'stock'
  | 'audit'
  | 'admin'
  | 'other';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  category?: NotificationCategory;
  action?: {
    label: string;
    link: string;
  };
}

type StoredNotification = Omit<Notification, 'timestamp'> & { timestamp: string };

export interface NotificationPreferences {
  onlyRequests: boolean;
}

function defaultPreferences(): NotificationPreferences {
  return { onlyRequests: false };
}

function normalizeEmail(email: unknown): string {
  return String(email ?? '').trim().toLowerCase();
}

function storageKeyForEmail(email: string): string {
  return `leoni-notifications:${normalizeEmail(email)}`;
}

function preferencesKeyForEmail(email: string): string {
  return `leoni-notification-preferences:${normalizeEmail(email)}`;
}

function deserializePreferences(raw: unknown): NotificationPreferences {
  const prefs = defaultPreferences();
  if (!raw || typeof raw !== 'object') return prefs;
  return {
    ...prefs,
    onlyRequests: Boolean((raw as any).onlyRequests),
  };
}

function inferCategory(n: Pick<Notification, 'title' | 'message' | 'action'>): NotificationCategory {
  const link = String(n?.action?.link ?? '').trim().toLowerCase();
  const text = `${String(n?.title ?? '')} ${String(n?.message ?? '')}`.trim().toLowerCase();

  const mentionsPR = text.includes('purchase request') || text.includes('new pr') || /^pr\b/.test(text);
  const mentionsPO = text.includes('purchase order') || text.includes('new po') || /^po\b/.test(text);

  if (link === '/admin' || link.startsWith('/admin/')) return 'admin';
  if (link === '/audit-logs' || link.startsWith('/audit-logs/')) return 'audit';
  if (link === '/maintenance' || link.startsWith('/maintenance/')) return 'maintenance';
  if (link === '/stock-inventory' || link.startsWith('/stock-inventory/')) return 'stock';
  if (link === '/assignments' || link.startsWith('/assignments/')) {
    if (text.includes('request') || text.includes('pending')) return 'request';
    return 'assignment';
  }
  if (link === '/orders' || link.startsWith('/orders/')) {
    if (mentionsPR) return 'request';
    if (mentionsPO) return 'order';
    // If it's orders but ambiguous, treat as request to match "demande" expectations.
    return 'request';
  }

  if (mentionsPR) return 'request';
  if (mentionsPO) return 'order';

  return 'other';
}

function deserializeNotifications(raw: unknown): Notification[] {
  if (!Array.isArray(raw)) return [];
  const out: Notification[] = [];
  for (const item of raw as any[]) {
    if (!item || typeof item !== 'object') continue;
    const ts = new Date(String((item as any).timestamp ?? ''));
    out.push({
      id: String((item as any).id ?? ''),
      type: ((item as any).type as any) ?? 'info',
      title: String((item as any).title ?? ''),
      message: String((item as any).message ?? ''),
      timestamp: Number.isFinite(ts.getTime()) ? ts : new Date(),
      read: Boolean((item as any).read),
      action: (item as any).action ? { label: String((item as any).action.label ?? ''), link: String((item as any).action.link ?? '') } : undefined,
    });
  }
  return out.filter((n) => !!n.id);
}

function serializeNotifications(list: Notification[]): StoredNotification[] {
  return list.map((n) => ({
    ...n,
    timestamp: n.timestamp instanceof Date ? n.timestamp.toISOString() : new Date().toISOString(),
  }));
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  setPreferences: (patch: Partial<NotificationPreferences>) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const role: UserRole = (user?.role as UserRole) || 'Reader';
  const email = normalizeEmail(user?.email);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferencesState] = useState<NotificationPreferences>(defaultPreferences());

  const isVisibleForRole = (r: UserRole, n: Notification) => {
    if (r === 'Admin') return true;
    if (r === 'Reader') return false;

    const link = String(n?.action?.link ?? '').trim().toLowerCase();
    const isAdminArea = link === '/admin' || link.startsWith('/admin/');
    const isAuditLogs = link === '/audit-logs' || link.startsWith('/audit-logs/');
    const isOrders = link === '/orders' || link.startsWith('/orders/');
    const isVendorPortal = link === '/vendor-portal' || link.startsWith('/vendor-portal/');

    if (r === 'Manager') {
      // Manager does not have notifications for Audit Logs and Administration.
      if (isAdminArea || isAuditLogs) return false;
      return true;
    }

    if (r === 'Technician') {
      // Technician does not have notifications for Orders, Vendor Portal, Audit Logs, Administration.
      if (isAdminArea || isAuditLogs || isOrders || isVendorPortal) return false;
      return true;
    }

    return false;
  };

  const visibleNotifications = useMemo(() => {
    const normalized = notifications.map((n) => (n.category ? n : { ...n, category: inferCategory(n) }));
    return normalized.filter((n) => {
      if (!isVisibleForRole(role, n)) return false;
      if (preferences.onlyRequests) return (n.category ?? inferCategory(n)) === 'request';
      return true;
    });
  }, [notifications, role, preferences.onlyRequests]);

  const unreadCount = useMemo(() => {
    return visibleNotifications.filter((n) => !n.read).length;
  }, [visibleNotifications]);

  // Load notifications per-user (by email). Each user gets their own inbox.
  useEffect(() => {
    if (!email) {
      setNotifications([]);
      setPreferencesState(defaultPreferences());
      return;
    }

    try {
      const raw = localStorage.getItem(storageKeyForEmail(email));
      if (!raw) {
        setNotifications([]);
        return;
      }
      const parsed = JSON.parse(raw);
      setNotifications(deserializeNotifications(parsed));
    } catch {
      setNotifications([]);
    }

    try {
      const rawPrefs = localStorage.getItem(preferencesKeyForEmail(email));
      if (!rawPrefs) {
        setPreferencesState(defaultPreferences());
      } else {
        setPreferencesState(deserializePreferences(JSON.parse(rawPrefs)));
      }
    } catch {
      setPreferencesState(defaultPreferences());
    }
  }, [email]);

  // Persist current user's notifications.
  useEffect(() => {
    if (!email) return;
    try {
      localStorage.setItem(storageKeyForEmail(email), JSON.stringify(serializeNotifications(notifications)));
    } catch {
      // ignore
    }
  }, [email, notifications]);

  // Persist preferences per-user.
  useEffect(() => {
    if (!email) return;
    try {
      localStorage.setItem(preferencesKeyForEmail(email), JSON.stringify(preferences));
    } catch {
      // ignore
    }
  }, [email, preferences]);

  const setPreferences = (patch: Partial<NotificationPreferences>) => {
    setPreferencesState((prev) => ({ ...prev, ...patch }));
  };

  const upsertNotification = (next: Notification) => {
    const withCategory = next.category ? next : { ...next, category: inferCategory(next) };

    if (role === 'Reader') return;
    if (!email) return;
    if (!isVisibleForRole(role, withCategory)) return;

    setNotifications((prev) => {
      if (prev.some((n) => n.id === withCategory.id)) return prev;
      return [withCategory, ...prev];
    });
  };

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      timestamp: new Date(),
      read: false,
      category: (notification as any)?.category ?? inferCategory(notification as any),
    };
    upsertNotification(newNotification);
  };

  // Shared notifications: delivered by backend over WebSocket.
  useEffect(() => {
    if (!email) return;
    if (role === 'Reader') return;

    let isStopped = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const cleanupWs = () => {
      try {
        ws?.close();
      } catch {
        // ignore
      }
      ws = null;
    };

    const connect = () => {
      if (isStopped) return;
      cleanupWs();

      try {
        ws = new WebSocket(getApiWsUrl('/ws'));
      } catch {
        reconnect();
        return;
      }

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev?.data ?? ''));
          if (!data || typeof data !== 'object') return;
          if ((data as any).type === 'ping') return;
          if ((data as any).type !== 'notification') return;

          const id = String((data as any).id ?? '').trim() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const ts = new Date(String((data as any).timestamp ?? ''));
          const timestamp = Number.isFinite(ts.getTime()) ? ts : new Date();

          upsertNotification({
            id,
            type: ((data as any).level as any) ?? 'info',
            title: String((data as any).title ?? 'Notification'),
            message: String((data as any).message ?? ''),
            timestamp,
            read: false,
            category: ((data as any).category as NotificationCategory) ?? undefined,
            action: (data as any).action
              ? {
                  label: String((data as any).action?.label ?? ''),
                  link: String((data as any).action?.link ?? ''),
                }
              : undefined,
          });
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        if (isStopped) return;
        reconnect();
      };

      ws.onerror = () => {
        cleanupWs();
        if (isStopped) return;
        reconnect();
      };
    };

    const reconnect = () => {
      if (isStopped) return;
      if (reconnectTimer != null) return;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, 1000);
    };

    connect();

    return () => {
      isStopped = true;
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
      cleanupWs();
    };
  }, [email, role]);

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications: visibleNotifications,
        unreadCount,
        preferences,
        setPreferences,
        addNotification,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
