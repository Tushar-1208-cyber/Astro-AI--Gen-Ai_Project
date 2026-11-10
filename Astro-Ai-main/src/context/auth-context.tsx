"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface User {
  id: string;
  email: string;
  name?: string;
  displayName?: string;
  photoURL?: string;
  role?: string;
}

export interface AuthContextType {
  user: User | null;
  authStatus: AuthStatus;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const publicRoutes = ['/login', '/signup'];

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const pathname = usePathname();
  const router = useRouter();

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        const resolvedUser: User = {
          ...data.user,
          displayName: data.user.name || data.user.email.split('@')[0],
          photoURL: '',
        };
        setUser(resolvedUser);
        setAuthStatus("authenticated");
      } else {
        setUser(null);
        setAuthStatus("unauthenticated");
      }
    } catch (error) {
      setUser(null);
      setAuthStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('[AuthContext] Logout error:', error);
    } finally {
      setUser(null);
      setAuthStatus("unauthenticated");
      router.push('/login');
      router.refresh();
    }
  };

  useEffect(() => {
    if (authStatus === 'loading') return;

    const isAuthPage = publicRoutes.includes(pathname);

    if (authStatus === 'unauthenticated' && !isAuthPage) {
      router.push('/login');
    } else if (authStatus === 'authenticated' && isAuthPage) {
      router.push('/');
    }
  }, [authStatus, pathname, router]);

  if (authStatus === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Initializing Astro AI secure session...</p>
      </div>
    );
  }

  // If on a public page or authenticated, render children
  if (publicRoutes.includes(pathname) || authStatus === 'authenticated') {
    return (
      <AuthContext.Provider value={{ user, authStatus, logout, refreshUser: checkAuth }}>
        {children}
      </AuthContext.Provider>
    );
  }

  // Unauthenticated user on private page: show loader while redirecting
  return (
    <div className="flex flex-col items-center justify-center h-screen space-y-4">
      <Loader2 className="w-12 h-12 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Redirecting to login...</p>
    </div>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
