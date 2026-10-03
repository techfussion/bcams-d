/**
 * Empty State & Error State components
 */
import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FileQuestion, AlertCircle, RefreshCw } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}>
      <div className="rounded-full bg-muted p-4 mb-4">
        {icon || <FileQuestion className="h-8 w-8 text-muted-foreground" />}
      </div>
      <h3 className="text-card-heading mb-1">{title}</h3>
      {description && (
        <p className="text-body text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <Button variant="outline" onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}>
      <div className="rounded-full bg-destructive-50 p-4 mb-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="text-card-heading mb-1">{title}</h3>
      <p className="text-body text-muted-foreground max-w-sm mb-4">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} size="sm">
          <RefreshCw className="h-4 w-4 mr-1" />
          Retry
        </Button>
      )}
    </div>
  );
}

// ─── Skeleton Loaders ───────────────────────────────────────────────────────

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="skeleton h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="skeleton h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-border p-card-padding space-y-3">
      <div className="skeleton h-4 w-1/3" />
      <div className="skeleton h-8 w-1/2" />
      <div className="skeleton h-3 w-2/3" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-lg border border-border p-card-padding space-y-2">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton h-8 w-16" />
      <div className="skeleton h-3 w-32" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="p-page space-y-section animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-9 w-32" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <CardSkeleton />
    </div>
  );
}
