'use client';

import * as React from 'react';
import { Check, MoreHorizontal, Pencil, SkipForward, Undo2 } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Enums } from '@/lib/db/database.types';

export type HabitItemProps = {
  id: string;
  name: string;
  status: Enums<'completion_status'> | null;
  isOptional: boolean;
  /** Shown under the name — a recipe summary, a time hint, a note. */
  detail?: string | null;
  modification?: string | null;
  pending?: boolean;
  onSetStatus: (status: Enums<'completion_status'> | null) => void;
  onModify?: () => void;
};

const STATUS_LABEL: Record<Enums<'completion_status'>, string> = {
  completed: 'Done',
  skipped: 'Skipped',
  modified: 'Adjusted',
};

/**
 * One habit, one tap.
 *
 * The whole row is the button for the common case (mark done / undo). Skip and
 * Modify live behind an overflow menu so the primary target stays large — this
 * is used one-handed, often while walking.
 *
 * A skipped habit is styled as *addressed*, not as a failure: muted, no red, no
 * warning icon. Skipping is a valid answer.
 */
export function HabitItem({
  name,
  status,
  isOptional,
  detail,
  modification,
  pending,
  onSetStatus,
  onModify,
}: HabitItemProps) {
  const done = status === 'completed' || status === 'modified';
  const skipped = status === 'skipped';

  return (
    <li
      className={cn(
        'group flex items-center gap-1 rounded-xl transition-colors',
        pending && 'opacity-60',
      )}
    >
      <button
        type="button"
        onClick={() => onSetStatus(done ? null : 'completed')}
        aria-pressed={done}
        /*
         * The visible text alone would name this button "Gentle cleanser" — the
         * object, with no hint of what pressing it does. Screen-reader users
         * got a list of nouns. The neighbouring Skip button was already
         * labelled "Skip Gentle cleanser"; this mirrors it.
         */
        aria-label={done ? `Mark ${name} not done` : `Mark ${name} done`}
        className={cn(
          'flex min-h-14 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
          'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <span
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-all',
            done
              ? 'animate-check-pop border-primary bg-primary text-primary-foreground'
              : skipped
                ? 'border-dashed border-muted-foreground/50 text-muted-foreground'
                : 'border-border group-hover:border-primary/50',
          )}
          aria-hidden="true"
        >
          {done ? <Check className="size-3.5" strokeWidth={3} /> : null}
          {skipped ? <SkipForward className="size-3" /> : null}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block break-words text-[15px] font-medium leading-tight',
              done && 'text-muted-foreground line-through decoration-muted-foreground/40',
              skipped && 'text-muted-foreground',
            )}
          >
            {name}
          </span>
          {(modification ?? detail) ? (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {modification ?? detail}
            </span>
          ) : null}
        </span>

        {isOptional && !status ? (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Optional
          </span>
        ) : null}

        {status ? (
          <span className="sr-only">{STATUS_LABEL[status]}</span>
        ) : null}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground"
            aria-label={`More options for ${name}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status ? (
            <DropdownMenuItem onSelect={() => onSetStatus(null)}>
              <Undo2 aria-hidden="true" />
              Clear
            </DropdownMenuItem>
          ) : null}
          {status !== 'completed' ? (
            <DropdownMenuItem onSelect={() => onSetStatus('completed')}>
              <Check aria-hidden="true" />
              Mark done
            </DropdownMenuItem>
          ) : null}
          {status !== 'skipped' ? (
            <DropdownMenuItem onSelect={() => onSetStatus('skipped')}>
              <SkipForward aria-hidden="true" />
              Skip today
            </DropdownMenuItem>
          ) : null}
          {onModify ? (
            <DropdownMenuItem onSelect={onModify}>
              <Pencil aria-hidden="true" />
              Log a change
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
