/**
 * Compact Inline Metric Component
 * 
 * Reusable summary metric for headers, toolbars, and ledger controls.
 * Allows pages to display key metrics (e.g. Average Attendance) without
 * forcing full summary-card grids.
 */
import React from 'react';
import { cn } from '@/lib/utils';

export interface CompactMetricProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'primary';
  className?: string;
}

export function CompactMetric({
  label,
  value,
  subValue,
  icon,
  variant = 'default',
  className,
}: CompactMetricProps) {
  const variantStyles = {
    default: 'border-border bg-muted/40 text-foreground',
    primary: 'border-primary-200 bg-primary-50/50 text-primary-900',
    success: 'border-emerald-200 bg-emerald-50/50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50/50 text-amber-900',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs shadow-2xs transition-colors',
        variantStyles[variant],
        className
      )}
    >
      {icon && <span className="text-muted-foreground flex-shrink-0">{icon}</span>}
      <span className="text-muted-foreground font-medium">{label}:</span>
      <span className="font-bold font-mono text-foreground">{value}</span>
      {subValue && (
        <span className="text-[11px] text-muted-foreground">({subValue})</span>
      )}
    </div>
  );
}
