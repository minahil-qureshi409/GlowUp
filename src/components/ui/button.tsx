import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98] motion-reduce:active:scale-100',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-soft hover:bg-primary/90',
        brand:
          'bg-gradient-brand text-white shadow-glow hover:brightness-[1.06] dark:text-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        outline: 'border border-input bg-card hover:bg-muted/60',
        ghost: 'hover:bg-muted/70',
        subtle: 'bg-muted/60 text-foreground hover:bg-muted',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link: 'text-primary underline-offset-4 hover:underline rounded-md',
      },
      size: {
        // 44px min height on the default and larger sizes: phone-first tap targets.
        default: 'h-11 px-5 py-2',
        sm: 'h-9 px-3.5 text-[13px]',
        lg: 'h-12 px-7 text-base',
        icon: 'size-11',
        'icon-sm': 'size-9',
        /*
         * The full-width commitment button at the bottom of a screen. A
         * rounded rectangle rather than a pill: at full width a pill reads as
         * a lozenge and stops looking pressable.
         */
        cta: 'h-14 w-full rounded-2xl px-5 text-[15.5px] font-semibold',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
