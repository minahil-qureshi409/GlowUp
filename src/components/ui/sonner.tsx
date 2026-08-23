'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

/**
 * Toasts inherit the app palette rather than sonner's defaults, so a
 * confirmation never arrives in a colour the design system doesn't own.
 */
export function Toaster(props: ToasterProps) {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      position="top-center"
      offset={12}
      toastOptions={{
        classNames: {
          toast:
            'group rounded-xl border border-border bg-card text-card-foreground shadow-lifted text-sm',
          description: 'text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground rounded-full',
          cancelButton: 'bg-muted text-muted-foreground rounded-full',
        },
      }}
      {...props}
    />
  );
}
