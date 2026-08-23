'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { deleteWeightEntry } from '@/server/actions/weight';
import type { WeightEntry } from '@/services/weight';
import { formatDateKey, formatRelativeDay } from '@/lib/date';
import { formatDelta } from '@/lib/format';

type WeightEntryListProps = {
  /** Newest first. */
  entries: WeightEntry[];
  today: string;
};

const PAGE_SIZE = 10;

export function WeightEntryList({ entries, today }: WeightEntryListProps) {
  const [visible, setVisible] = React.useState(PAGE_SIZE);
  const [deleting, setDeleting] = React.useState<WeightEntry | null>(null);
  const [pending, startTransition] = React.useTransition();

  function remove(entry: WeightEntry) {
    startTransition(async () => {
      const result = await deleteWeightEntry(entry.id);
      if (result.ok) toast.success('Entry removed.');
      else toast.error(result.error);
    });
  }

  return (
    <>
      <Card>
        <CardContent className="p-2">
          <ul className="divide-y divide-border/70">
            {entries.slice(0, visible).map((entry, index) => {
              // Change against the next-older entry, which is the following
              // element because the list is newest-first.
              const previous = entries[index + 1];
              const delta = previous ? entry.weight_kg - previous.weight_kg : null;

              return (
                <li key={entry.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      <span className="tabular">{entry.weight_kg.toFixed(1)} kg</span>
                      {delta !== null && Math.abs(delta) >= 0.05 ? (
                        <span className="tabular ml-2 text-xs font-normal text-muted-foreground">
                          {formatDelta(delta)}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeDay(entry.entry_date, today)} ·{' '}
                      {formatDateKey(entry.entry_date, 'd MMM yyyy')}
                      {entry.note ? ` · ${entry.note}` : ''}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-muted-foreground"
                    disabled={pending}
                    onClick={() => setDeleting(entry)}
                    aria-label={`Delete weigh-in from ${formatDateKey(entry.entry_date, 'd MMMM yyyy')}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>

          {visible < entries.length ? (
            <Button
              variant="ghost"
              className="mt-1 w-full"
              onClick={() => setVisible((current) => current + PAGE_SIZE)}
            >
              Show more ({entries.length - visible} left)
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete this weigh-in?</AlertDialogTitle>
          <AlertDialogDescription>
            It will be removed from your chart and trend. This cannot be undone.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleting) remove(deleting);
                setDeleting(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
