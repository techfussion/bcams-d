/**
 * Auth Store
 * 
 * Manages the current authenticated user and role.
 * Frontend authorization is a UX mechanism, not a security boundary.
 */
import { create } from 'zustand';
import type { User, UserRole } from '@/types';
import { api, setMockUser } from '@/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  login: (userId?: string) => Promise<void>;
  logout: () => void;
}

const roleToUserId: Record<UserRole, string> = {
  super_admin: 'user-sa',
  hod: 'user-hod',
  lecturer: 'user-lec',
  student: 'user-stu-capturer',
  staff: 'user-staff-capturer',
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (userId?: string) => {
    set({ isLoading: true });
    try {
      if (userId) {
        setMockUser(userId);
      }
      const user = await api.getCurrentUser();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  logout: () => {
    set({ user: null, isAuthenticated: false, isLoading: false });
  },
}));
