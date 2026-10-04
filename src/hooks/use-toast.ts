/**
 * Toast Notification System
 * 
 * Provides a centralized toast store and hook for success/error/warning/info
 * notifications throughout the application. Built on Zustand for simplicity.
 * Supports both object options { title, description, variant } and shorthand methods.
 */
import { create } from 'zustand';

export type ToastVariant = 'default' | 'success' | 'destructive' | 'warning';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number; // ms
  createdAt: number;
}

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => string;
  dismissToast: (id: string) => void;
  clearAll: () => void;
}

let toastCounter = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${++toastCounter}-${Date.now()}`;
    const newToast: Toast = {
      ...toast,
      id,
      createdAt: Date.now(),
    };
    set({ toasts: [...get().toasts, newToast] });

    // Auto-dismiss after duration
    setTimeout(() => {
      get().dismissToast(id);
    }, toast.duration);

    return id;
  },

  dismissToast: (id) => {
    set({ toasts: get().toasts.filter(t => t.id !== id) });
  },

  clearAll: () => {
    set({ toasts: [] });
  },
}));

/**
 * Convenience hook wrapping the toast store.
 * Supports:
 *   toast({ title: '...', description: '...', variant: 'success' })
 *   toast('Title', 'Description', 'success')
 *   toast.success('Title', 'Description')
 */
export function useToast() {
  const { addToast, dismissToast, clearAll } = useToastStore();

  const toastFn = (
    titleOrOptions: string | ToastOptions,
    description?: string,
    variant: ToastVariant = 'default',
    duration = 4000
  ) => {
    if (typeof titleOrOptions === 'object') {
      return addToast({
        title: titleOrOptions.title,
        description: titleOrOptions.description,
        variant: titleOrOptions.variant || 'default',
        duration: titleOrOptions.duration || 4000,
      });
    }
    return addToast({ title: titleOrOptions, description, variant, duration });
  };

  const toast = Object.assign(toastFn, {
    success: (title: string, description?: string) =>
      addToast({ title, description, variant: 'success', duration: 3000 }),
    error: (title: string, description?: string) =>
      addToast({ title, description, variant: 'destructive', duration: 5000 }),
    warning: (title: string, description?: string) =>
      addToast({ title, description, variant: 'warning', duration: 4000 }),
    info: (title: string, description?: string) =>
      addToast({ title, description, variant: 'default', duration: 3500 }),
    dismiss: dismissToast,
    clearAll,
  });

  return {
    toast,
    success: toast.success,
    error: toast.error,
    warning: toast.warning,
    info: toast.info,
    dismiss: dismissToast,
    clearAll,
  };
}
