/**
 * Confirm Dialog
 * 
 * Reusable confirmation dialog for destructive or critical actions.
 * Uses @radix-ui/react-alert-dialog for accessible modal behavior.
 */
import React from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'warning' | 'default';
  onConfirm: () => void;
  isLoading?: boolean;
}

const variantConfig = {
  destructive: {
    iconBg: 'bg-destructive-50',
    iconColor: 'text-destructive',
    buttonVariant: 'destructive' as const,
  },
  warning: {
    iconBg: 'bg-warning-50',
    iconColor: 'text-warning-600',
    buttonVariant: 'default' as const,
  },
  default: {
    iconBg: 'bg-primary-50',
    iconColor: 'text-primary',
    buttonVariant: 'default' as const,
  },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  onConfirm,
  isLoading = false,
}: ConfirmDialogProps) {
  const config = variantConfig[variant];

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-xl shadow-xl p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex gap-4">
            <div className={cn('flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center', config.iconBg)}>
              <AlertTriangle className={cn('h-5 w-5', config.iconColor)} />
            </div>
            <div className="flex-1">
              <AlertDialog.Title className="text-base font-semibold text-foreground">
                {title}
              </AlertDialog.Title>
              <AlertDialog.Description className="text-sm text-muted-foreground mt-1">
                {description}
              </AlertDialog.Description>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" size="sm" disabled={isLoading}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant={config.buttonVariant}
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  onConfirm();
                }}
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
