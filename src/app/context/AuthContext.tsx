import React, { createContext, useContext, useState } from 'react';
import type { User } from '../types';
import { authChangePassword, authLogin } from '../data/api';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  updateUser: (patch: Partial<User>) => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const currentEmailKey = 'leoni-auth-current-email';
  const currentRoleKey = 'leoni-auth-current-role';
  const currentNameKey = 'leoni-auth-current-name';

  const avatarKeyForEmail = (email: string) => `leoni-profile-avatar:${String(email ?? '').trim().toLowerCase()}`;
  const roleKeyForEmail = (email: string) => `leoni-profile-role:${String(email ?? '').trim().toLowerCase()}`;

  const readCurrentUserFromStorage = (): User | null => {
    try {
      const email = String(localStorage.getItem(currentEmailKey) ?? '').trim().toLowerCase();
      if (!email) return null;

      const savedAvatarUrl = localStorage.getItem(avatarKeyForEmail(email)) ?? '';
      const savedRole = localStorage.getItem(currentRoleKey) ?? localStorage.getItem(roleKeyForEmail(email)) ?? '';
      const savedName = localStorage.getItem(currentNameKey) ?? '';

      const role = (String(savedRole || '').trim() as any) || 'Reader';
      const name = String(savedName || '').trim() || email;

      return {
        id: email,
        name,
        email,
        role,
        avatarUrl: String(savedAvatarUrl || ''),
      };
    } catch {
      return null;
    }
  };

  const [user, setUser] = useState<User | null>(() => readCurrentUserFromStorage());

  const loadSavedRole = (email: string) => {
    try {
      return localStorage.getItem(roleKeyForEmail(email)) ?? '';
    } catch {
      return '';
    }
  };

  const login = async (email: string, password: string) => {
    const normalizedEmail = String(email ?? '').trim();
    const fallbackRole = (loadSavedRole(normalizedEmail) as any) || 'Reader';

    try {
      const backendUser = await authLogin({ email: normalizedEmail, password: String(password ?? '') });
      const savedAvatarUrl = (() => {
        try {
          return localStorage.getItem(avatarKeyForEmail(normalizedEmail)) ?? '';
        } catch {
          return '';
        }
      })();

      const nextUser: User = {
        id: String((backendUser as any)?.id ?? ''),
        name: String((backendUser as any)?.name ?? ''),
        email: String((backendUser as any)?.email ?? normalizedEmail),
        role: ((backendUser as any)?.role as any) || fallbackRole,
        avatarUrl: String((backendUser as any)?.avatarUrl ?? savedAvatarUrl),
      };

      // Persist chosen role for offline fallback.
      try {
        localStorage.setItem(roleKeyForEmail(normalizedEmail), String((nextUser as any).role ?? fallbackRole));
      } catch {
        // ignore
      }

      setUser(nextUser);

      try {
        localStorage.setItem(currentEmailKey, String(nextUser.email ?? '').trim().toLowerCase());
        localStorage.setItem(currentRoleKey, String((nextUser as any).role ?? fallbackRole));
        localStorage.setItem(currentNameKey, String(nextUser.name ?? '').trim());
      } catch {
        // ignore
      }

      return true;
    } catch {
      return false;
    }
  };

  const updateUser = (patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      if (patch.avatarUrl !== undefined) {
        try {
          localStorage.setItem(avatarKeyForEmail(prev.email), String(patch.avatarUrl ?? ''));
        } catch {
          // ignore
        }
      }
      if (patch.role !== undefined) {
        try {
          localStorage.setItem(roleKeyForEmail(prev.email), String(patch.role ?? ''));
          localStorage.setItem(currentRoleKey, String(patch.role ?? ''));
        } catch {
          // ignore
        }
      }
      if (patch.name !== undefined) {
        try {
          localStorage.setItem(currentNameKey, String(patch.name ?? ''));
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const email = String(user?.email ?? '').trim();
    if (!email) return { ok: false, error: 'Not authenticated' };

    const next = String(newPassword ?? '');
    if (next.length < 6) return { ok: false, error: 'Password must be at least 6 characters' };

    try {
      await authChangePassword({ email, currentPassword: String(currentPassword ?? ''), newPassword: next });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? 'Unable to change password') };
    }
  };

  const logout = () => {
    setUser(null);

    try {
      localStorage.removeItem(currentEmailKey);
      localStorage.removeItem(currentRoleKey);
      localStorage.removeItem(currentNameKey);
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, updateUser, changePassword, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
