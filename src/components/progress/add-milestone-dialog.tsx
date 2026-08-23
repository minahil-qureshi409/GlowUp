'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { saveTimelineMilestone } from '@/server/actions/progress';
import {
  timelineMilestoneSchema,
  type TimelineMilestoneInput,
} from '@/lib/validation/schemas';

/** Lets the user mark anything they consider a milestone — the app doesn't decide. */
export function AddMilestoneDialog({ today }: { today: string }) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [formError, setFormError] = React.useState<string | null>(null);

  const form = useForm<TimelineMilestoneInput>({
    resolver: zodResolver(timelineMilestoneSchema),
    defaultValues: { occurred_on: today, title: '', description: '' },
  });

  function onSubmit(values: TimelineMilestoneInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await saveTimelineMilestone(values);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success('Added to your timeline.');
      form.reset({ occurred_on: today, title: '', description: '' });
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          Milestone
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a milestone</DialogTitle>
          <DialogDescription>Anything worth remembering. Your call what counts.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="milestone-title">What happened</Label>
            <Input
              id="milestone-title"
              placeholder="e.g. First full push-up"
              {...form.register('title')}
            />
            {form.formState.errors.title ? (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="milestone-date">Date</Label>
            <Input id="milestone-date" type="date" max={today} {...form.register('occurred_on')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="milestone-description">Notes (optional)</Label>
            <Textarea id="milestone-description" rows={2} {...form.register('description')} />
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
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
