/**
 * Toaster Component
 * 
 * Renders active toast notifications as an overlay in the bottom-right corner.
 * Toasts animate in/out and can be manually dismissed.
 */
import React, { useEffect, useState } from 'react';
import { useToastStore, type Toast, type ToastVariant } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const variantStyles: Record<ToastVariant, string> = {
  default: 'bg-white border-border text-foreground',
  success: 'bg-white border-success-300 text-foreground',
  destructive: 'bg-white border-destructive-300 text-foreground',
  warning: 'bg-white border-warning-300 text-foreground',
};

const variantIcons: Record<ToastVariant, React.ReactNode> = {
  default: <Info className="h-4 w-4 text-primary flex-shrink-0" />,
  success: <CheckCircle2 className="h-4 w-4 text-success-600 flex-shrink-0" />,
  destructive: <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 text-warning-600 flex-shrink-0" />,
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    const enterTimer = requestAnimationFrame(() => setIsVisible(true));

    // Start exit animation before auto-dismiss
    const exitDelay = toast.duration - 300;
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, exitDelay > 0 ? exitDelay : toast.duration * 0.8);

    return () => {
      cancelAnimationFrame(enterTimer);
      clearTimeout(exitTimer);
    };
  }, [toast.duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(onDismiss, 200);
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 max-w-[360px] w-full px-4 py-3 rounded-lg border shadow-lg transition-all duration-200',
        variantStyles[toast.variant],
        isVisible && !isExiting
          ? 'translate-x-0 opacity-100'
          : 'translate-x-4 opacity-0'
      )}
      role="alert"
      aria-live="assertive"
    >
      {variantIcons[toast.variant]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{toast.description}</p>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-sm hover:bg-muted"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function Toaster() {
  const { toasts, dismissToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-auto"
      aria-label="Notifications"
    >
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={() => dismissToast(toast.id)}
        />
      ))}
    </div>
  );
}
