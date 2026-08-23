'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { saveGoal } from '@/server/actions/settings';
import { goalSchema, type GoalInput } from '@/lib/validation/schemas';
import type { Goal, GoalMilestone } from '@/services/weight';
import { NO_COUNTDOWN_NOTE } from '@/lib/domain/copy';
import { formatWeight } from '@/lib/format';

type GoalFormProps = {
  goal: Goal | null;
  milestones: GoalMilestone[];
};

export function GoalForm({ goal, milestones }: GoalFormProps) {
  const [pending, startTransition] = React.useTransition();

  const form = useForm<GoalInput>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      ...(goal?.id ? { id: goal.id } : {}),
      type: 'weight',
      title: goal?.title ?? 'Reach a healthy weight',
      description: goal?.description ?? '',
      start_value: goal?.start_value ?? null,
      target_value: goal?.target_value ?? null,
      unit: goal?.unit ?? 'kg',
    },
  });

  function onSubmit(values: GoalInput) {
    startTransition(async () => {
      const result = await saveGoal(values);
      if (result.ok) toast.success('Goal updated.');
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="goal-title">Goal</Label>
              <Input id="goal-title" {...form.register('title')} />
              {form.formState.errors.title ? (
                <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="goal-start">Starting weight (kg)</Label>
                <Input
                  id="goal-start"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  {...form.register('start_value', {
                    setValueAs: (value) => (value === '' ? null : Number(value)),
                  })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goal-target">Goal weight (kg)</Label>
                <Input
                  id="goal-target"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  {...form.register('target_value', {
                    setValueAs: (value) => (value === '' ? null : Number(value)),
                  })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="goal-description">Notes (optional)</Label>
              <Textarea id="goal-description" rows={2} {...form.register('description')} />
            </div>

            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              {NO_COUNTDOWN_NOTE} GlowUp will not put a date on it or set a pace for you.
            </p>

            <Button type="submit" variant="brand" disabled={pending} className="w-full sm:w-auto">
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Save goal
            </Button>
          </form>
        </CardContent>
      </Card>

      {milestones.length > 0 ? (
        <Card>
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold">Milestones</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Rebuilt automatically when you change your starting or goal weight.
            </p>
            <ul className="mt-3 space-y-1.5">
              {milestones.map((milestone) => (
                <li key={milestone.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{milestone.label}</span>
                  <span className="tabular font-medium">
                    {formatWeight(milestone.target_value)}
                    {milestone.achieved_at ? ' ✓' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
