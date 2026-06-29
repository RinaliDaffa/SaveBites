/**
 * SaveBites V3 — Auth Zustand Store (persisted to localStorage)
 * Manages user identity, role, and sign-in/sign-out flow.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Profile } from '@/lib/types/database';

export type UserRole = 'consumer' | 'merchant' | null;

interface AuthState {
  user: Profile | null;
  role: UserRole;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  signIn: (profile: Profile, role: UserRole) => void;
  signUp: (profile: Profile, role: UserRole) => void;
  signOut: () => void;
  updateProfile: (updates: Partial<Profile>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      isLoading: false,
      error: null,

      signIn: (profile, role) => {
        set({ user: profile, role, error: null });
      },

      signUp: (profile, role) => {
        set({ user: profile, role, error: null });
      },

      signOut: () => {
        set({ user: null, role: null, error: null });
      },

      updateProfile: (updates) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        }));
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      setError: (error) => {
        set({ error });
      },
    }),
    {
      name: 'savebites-auth',
      partialize: (state) => ({
        user: state.user,
        role: state.role,
      }),
    }
  )
);

/** Convenience hook to check if user is authenticated */
export const useIsAuthenticated = (): boolean => {
  const store = useAuthStore();
  return store.user !== null && store.role !== null;
};
