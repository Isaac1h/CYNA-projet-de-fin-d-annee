'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase, SUPABASE_ENABLED } from '@/lib/supabase';
import { validateEmail, validatePassword, hashPassword, generateSessionToken } from '@/lib/auth';
import { useToast } from '@/components/ui/use-toast';

export type CurrentUser = {
  id: string;
  email: string;
  full_name?: string;
};

type StoredUser = CurrentUser & {
  password_hash: string;
  created_at: string;
  updated_at: string;
};

type StoredSession = {
  user: CurrentUser;
  expiresAt: number;
};

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

type AuthContextValue = {
  currentUser: CurrentUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  register: (email: string, password: string, fullName: string) => Promise<Result>;
  login: (email: string, password: string) => Promise<Result>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<Result>;
  updateProfile: (updates: Partial<CurrentUser>) => Promise<Result>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const raw = localStorage.getItem('session');
    if (raw) {
      const session = JSON.parse(raw) as StoredSession;
      if (session.expiresAt > Date.now()) {
        setCurrentUser(session.user);
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('session');
      }
    }
    setLoading(false);
  }, []);

  const register = async (email: string, password: string, fullName: string): Promise<Result> => {
    try {
      if (!validateEmail(email)) {
        throw new Error('Invalid email format');
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.errors.join('. '));
      }

      if (SUPABASE_ENABLED) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw new Error(error.message);
        toast({
          title: 'Registration successful!',
          description: 'Please check your email to verify your account.',
        });
        return { success: true, data };
      }

      const users = JSON.parse(localStorage.getItem('users') ?? '[]') as StoredUser[];
      if (users.some((u) => u.email === email)) {
        throw new Error('User already exists with this email');
      }

      const passwordHash = await hashPassword(password);
      const newUser: StoredUser = {
        id: generateSessionToken(),
        email,
        password_hash: passwordHash,
        full_name: fullName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      users.push(newUser);
      localStorage.setItem('users', JSON.stringify(users));

      toast({
        title: 'Registration successful!',
        description: 'You can now log in with your credentials.',
      });
      return { success: true, data: newUser };
    } catch (error) {
      const message = errorMessage(error);
      toast({ title: 'Registration failed', description: message, variant: 'destructive' });
      return { success: false, error: message };
    }
  };

  const login = async (email: string, password: string): Promise<Result> => {
    try {
      if (SUPABASE_ENABLED) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
        if (data?.user) {
          setCurrentUser({
            id: data.user.id,
            email: data.user.email ?? email,
            full_name: data.user.user_metadata?.full_name,
          });
          setIsAuthenticated(true);
        }
        toast({ title: 'Welcome back!', description: 'You have successfully logged in.' });
        return { success: true, data };
      }

      const users = JSON.parse(localStorage.getItem('users') ?? '[]') as StoredUser[];
      const passwordHash = await hashPassword(password);
      const user = users.find((u) => u.email === email && u.password_hash === passwordHash);
      if (!user) {
        throw new Error('Invalid email or password');
      }

      const session: StoredSession = {
        user: { id: user.id, email: user.email, full_name: user.full_name },
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };
      localStorage.setItem('session', JSON.stringify(session));
      setCurrentUser(session.user);
      setIsAuthenticated(true);
      toast({ title: 'Welcome back!', description: 'You have successfully logged in.' });
      return { success: true, data: session };
    } catch (error) {
      const message = errorMessage(error);
      toast({ title: 'Login failed', description: message, variant: 'destructive' });
      return { success: false, error: message };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      if (SUPABASE_ENABLED) {
        await supabase.auth.signOut();
      }
      localStorage.removeItem('session');
      setCurrentUser(null);
      setIsAuthenticated(false);
      toast({ title: 'Logged out', description: 'You have been successfully logged out.' });
    } catch (error) {
      toast({ title: 'Logout failed', description: errorMessage(error), variant: 'destructive' });
    }
  };

  const resetPassword = async (email: string): Promise<Result> => {
    try {
      if (!validateEmail(email)) {
        throw new Error('Invalid email format');
      }
      if (SUPABASE_ENABLED) {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw new Error(error.message);
      }
      toast({
        title: 'Password reset email sent',
        description: 'Please check your email for instructions.',
      });
      return { success: true };
    } catch (error) {
      const message = errorMessage(error);
      toast({ title: 'Password reset failed', description: message, variant: 'destructive' });
      return { success: false, error: message };
    }
  };

  const updateProfile = async (updates: Partial<CurrentUser>): Promise<Result> => {
    try {
      if (!currentUser) throw new Error('Not authenticated');

      if (SUPABASE_ENABLED) {
        const { error } = await supabase.from('users').update(updates).eq('id', currentUser.id);
        if (error) throw new Error(error.message);
      } else {
        const users = JSON.parse(localStorage.getItem('users') ?? '[]') as StoredUser[];
        const userIndex = users.findIndex((u) => u.id === currentUser.id);
        if (userIndex !== -1) {
          users[userIndex] = {
            ...users[userIndex],
            ...updates,
            updated_at: new Date().toISOString(),
          };
          localStorage.setItem('users', JSON.stringify(users));

          const sessionRaw = localStorage.getItem('session');
          if (sessionRaw) {
            const session = JSON.parse(sessionRaw) as StoredSession;
            session.user = { ...session.user, ...updates };
            localStorage.setItem('session', JSON.stringify(session));
            setCurrentUser(session.user);
          }
        }
      }

      toast({ title: 'Profile updated', description: 'Your profile has been successfully updated.' });
      return { success: true };
    } catch (error) {
      const message = errorMessage(error);
      toast({ title: 'Update failed', description: message, variant: 'destructive' });
      return { success: false, error: message };
    }
  };

  const value: AuthContextValue = {
    currentUser,
    isAuthenticated,
    loading,
    register,
    login,
    logout,
    resetPassword,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
