'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { logWeight } from '@/server/actions/weight';
import { weightEntrySchema, type WeightEntryInput } from '@/lib/validation/schemas';
import { milestonePhrase, NO_COUNTDOWN_NOTE } from '@/lib/domain/copy';

type LogWeightDialogProps = {
  today: string;
  lastWeightKg: number | null;
  trigger?: React.ReactNode;
};

/**
 * Quick weigh-in entry.
 *
 * Pre-filled with the last known weight and adjustable in 0.1 kg steps, so the
 * common case is two taps and no keyboard. The date defaults to today but stays
 * editable for a weigh-in someone forgot to log.
 */
export function LogWeightDialog({ today, lastWeightKg, trigger }: LogWeightDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [formError, setFormError] = React.useState<string | null>(null);

  const form = useForm<WeightEntryInput>({
    resolver: zodResolver(weightEntrySchema),
    defaultValues: {
      weight_kg: lastWeightKg ?? 50,
      entry_date: today,
      note: '',
    },
  });

  const weight = form.watch('weight_kg');

  function nudge(delta: number) {
    const next = Number(((Number(weight) || 0) + delta).toFixed(1));
    form.setValue('weight_kg', Math.max(20, Math.min(400, next)), { shouldValidate: true });
  }

  function onSubmit(values: WeightEntryInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await logWeight(values);

      if (!result.ok) {
        setFormError(result.error);
        return;
      }

      setOpen(false);
      form.reset({ weight_kg: values.weight_kg, entry_date: today, note: '' });

      const reached = result.data.reachedMilestones;
      if (reached.length > 0) {
        // Milestones get one quiet acknowledgement, not a fanfare.
        const first = reached[0];
        if (first) toast.success(milestonePhrase(first.label, first.targetKg, 'kg'));
      } else {
        toast.success('Weight logged.');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="brand" className="w-full">
            Log weight
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log your weight</DialogTitle>
          <DialogDescription>{NO_COUNTDOWN_NOTE}</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="weight_kg" className="sr-only">
              Weight in kilograms
            </Label>
            <div className="flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => nudge(-0.1)}
                aria-label="Decrease by 0.1 kilograms"
              >
                <Minus />
              </Button>

              <div className="flex items-baseline gap-1.5">
                <Input
                  id="weight_kg"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  className="h-16 w-32 border-0 bg-transparent text-center font-display text-4xl font-semibold shadow-none focus-visible:ring-0"
                  aria-invalid={Boolean(form.formState.errors.weight_kg)}
                  {...form.register('weight_kg', { valueAsNumber: true })}
                />
                <span className="text-lg text-muted-foreground">kg</span>
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => nudge(0.1)}
                aria-label="Increase by 0.1 kilograms"
              >
                <Plus />
              </Button>
            </div>
            {form.formState.errors.weight_kg ? (
              <p className="text-center text-xs text-destructive">
                {form.formState.errors.weight_kg.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="entry_date">Date</Label>
              <Input id="entry_date" type="date" max={today} {...form.register('entry_date')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note">Note (optional)</Label>
              <Input id="note" placeholder="e.g. after breakfast" {...form.register('note')} />
            </div>
          </div>

          {formError ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
