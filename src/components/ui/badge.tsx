import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary-50 text-primary-700',
        success: 'bg-success-50 text-success-700',
        destructive: 'bg-destructive-50 text-destructive-700',
        warning: 'bg-warning-50 text-warning-700',
        muted: 'bg-muted text-muted-foreground',
        outline: 'border border-border text-foreground',
        // Semantic status variants
        online: 'bg-success-50 text-success-700',
        offline: 'bg-muted text-muted-foreground',
        syncing: 'bg-blue-50 text-blue-700',
        pending: 'bg-warning-50 text-warning-700',
        suspicious: 'bg-orange-50 text-orange-700',
        unverified: 'bg-purple-50 text-purple-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
