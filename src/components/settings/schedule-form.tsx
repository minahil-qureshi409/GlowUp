'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateSettings } from '@/server/actions/settings';
import { settingsSchema, type SettingsInput } from '@/lib/validation/schemas';
import type { UserSettings } from '@/services/profile';
import { DAY_NAMES, DAY_NAMES_SHORT } from '@/lib/date';
import { cn } from '@/lib/utils';

export function ScheduleForm({ settings }: { settings: UserSettings }) {
  const [pending, startTransition] = React.useTransition();

  const form = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      workouts_per_week: settings.workouts_per_week,
      preferred_workout_days: settings.preferred_workout_days,
      typical_work_start: settings.typical_work_start?.slice(0, 5) ?? null,
      typical_work_end: settings.typical_work_end?.slice(0, 5) ?? null,
      commute_minutes: settings.commute_minutes,
      weekly_weigh_in_day: settings.weekly_weigh_in_day,
      notifications_enabled: settings.notifications_enabled,
      quiet_hours_start: settings.quiet_hours_start.slice(0, 5),
      quiet_hours_end: settings.quiet_hours_end.slice(0, 5),
      max_daily_reminders: settings.max_daily_reminders,
      suggestions_enabled: settings.suggestions_enabled,
    },
  });

  const perWeek = form.watch('workouts_per_week');
  const preferredDays = form.watch('preferred_workout_days');

  function toggleDay(day: number) {
    const current = new Set(preferredDays);
    if (current.has(day)) current.delete(day);
    else current.add(day);
    form.setValue('preferred_workout_days', [...current].sort());
  }

  function onSubmit(values: SettingsInput) {
    startTransition(async () => {
      const result = await updateSettings(values);
      if (result.ok) toast.success('Preferences updated.');
      else toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardContent className="p-5">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Workouts per week</legend>
            <p className="text-xs text-muted-foreground">
              A weekly target, not fixed days. Nothing is scheduled for you.
            </p>
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Fewer workouts per week"
                onClick={() =>
                  form.setValue('workouts_per_week', Math.max(0, Number(perWeek) - 1))
                }
              >
                <Minus />
              </Button>
              <span className="tabular w-10 text-center font-display text-2xl">{perWeek}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="More workouts per week"
                onClick={() =>
                  form.setValue('workouts_per_week', Math.min(14, Number(perWeek) + 1))
                }
              >
                <Plus />
              </Button>
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Preferred days (optional)</legend>
            <p className="text-xs text-muted-foreground">
              Only a hint for suggestions — you are never held to these.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DAY_NAMES.map((name, index) => {
                const active = preferredDays.includes(index);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleDay(index)}
                    aria-pressed={active}
                    aria-label={name}
                    className={cn(
                      'min-h-10 min-w-11 rounded-full border px-3 text-sm transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active
                        ? 'border-primary bg-primary-soft text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted/60',
                    )}
                  >
                    {DAY_NAMES_SHORT[index]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Typical work day</legend>
            <p className="text-xs text-muted-foreground">
              Used only when no calendar is connected. Leave blank if it varies too much.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="work_start" className="text-xs">
                  Starts
                </Label>
                <Input
                  id="work_start"
                  type="time"
                  {...form.register('typical_work_start', {
                    setValueAs: (value) => (value === '' ? null : value),
                  })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="work_end" className="text-xs">
                  Ends
                </Label>
                <Input
                  id="work_end"
                  type="time"
                  {...form.register('typical_work_end', {
                    setValueAs: (value) => (value === '' ? null : value),
                  })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="commute" className="text-xs">
                  Commute (min)
                </Label>
                <Input
                  id="commute"
                  type="number"
                  inputMode="numeric"
                  {...form.register('commute_minutes', {
                    setValueAs: (value) => (value === '' ? null : Number(value)),
                  })}
                />
              </div>
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="weigh_in_day">Weekly weigh-in day</Label>
            <Select
              value={String(form.watch('weekly_weigh_in_day'))}
              onValueChange={(value) => form.setValue('weekly_weigh_in_day', Number(value))}
            >
              <SelectTrigger id="weigh_in_day">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_NAMES.map((name, index) => (
                  <SelectItem key={name} value={String(index)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              A gentle prompt on this day. You can log any day you like.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
            <div>
              <Label htmlFor="suggestions">Adaptive suggestions</Label>
              <p className="text-xs text-muted-foreground">
                Occasional observations based on what you actually do.
              </p>
            </div>
            <Switch
              id="suggestions"
              checked={form.watch('suggestions_enabled')}
              onCheckedChange={(checked) => form.setValue('suggestions_enabled', checked)}
            />
          </div>

          <Button type="submit" variant="brand" disabled={pending} className="w-full sm:w-auto">
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Save preferences
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
