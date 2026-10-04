import React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  indeterminate?: boolean;
}

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, indeterminate, checked, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    checked={indeterminate ? 'indeterminate' : checked}
    className={cn(
      'peer h-4 w-4 shrink-0 rounded border border-border ring-offset-background',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-white',
      'data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:text-white',
      'transition-colors duration-150',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      {indeterminate ? (
        <Minus className="h-3 w-3 stroke-[2.5]" />
      ) : (
        <Check className="h-3 w-3 stroke-[2.5]" />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;
