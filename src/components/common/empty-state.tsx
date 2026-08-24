import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
  /** `inline` drops the border for use inside an existing card. */
  variant?: 'card' | 'inline';
};

/**
 * Empty states say what the space is for and offer the next step. They never
 * imply the user should already have data here.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
  variant = 'card',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-10 text-center',
        variant === 'card' && 'rounded-3xl border border-dashed border-border bg-accent',
        className,
      )}
    >
      {Icon ? (
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {body ? <p className="mx-auto max-w-xs text-sm text-muted-foreground">{body}</p> : null}
      </div>
      {action}
    </div>
  );
}
