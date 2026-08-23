'use client';

import * as React from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { HabitWithStatus } from '@/lib/domain/habits';

type ModifyHabitDialogProps = {
  habit: HabitWithStatus | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (modification: string) => void;
};

/** Common adjustments, so the usual case is a tap rather than typing. */
const QUICK_NOTES = ['Half portion', 'Smaller than usual', 'Swapped it', 'Later than usual'];

/**
 * "Modified" is a first-class outcome alongside done and skipped — half a shake
 * is not a failure, and the app should be able to record what actually
 * happened without judging it.
 */
export function ModifyHabitDialog({ habit, onOpenChange, onSubmit }: ModifyHabitDialogProps) {
  const [value, setValue] = React.useState('');

  React.useEffect(() => {
    if (habit) setValue(habit.completion?.modification ?? '');
  }, [habit]);

  return (
    <Dialog open={Boolean(habit)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{habit?.name}</DialogTitle>
          <DialogDescription>
            Log what you actually did. It still counts toward your day.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {QUICK_NOTES.map((note) => (
              <Button
                key={note}
                type="button"
                variant={value === note ? 'default' : 'outline'}
                size="sm"
                onClick={() => setValue(note)}
              >
                {note}
              </Button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="modification">Or describe it</Label>
            <Input
              id="modification"
              value={value}
              maxLength={140}
              placeholder="e.g. shake without banana"
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="brand"
            disabled={value.trim().length === 0}
            onClick={() => onSubmit(value.trim())}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
