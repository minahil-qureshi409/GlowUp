'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveGymConfig } from '@/server/actions/settings';
import { gymConfigSchema, type GymConfigInput } from '@/lib/validation/schemas';
import type { GymConfig } from '@/services/profile';
import { DAY_NAMES, DAY_NAMES_SHORT } from '@/lib/date';
import { cn } from '@/lib/utils';

/**
 * Office gym configuration.
 *
 * The access window is editable because gym hours change — the app must never
 * treat the seeded 3 PM cutoff as permanent. Whatever is set here is a hard
 * boundary for office-gym suggestions: past it, the planner offers home instead.
 */
export function GymForm({ gym }: { gym: GymConfig | null }) {
  const [pending, startTransition] = React.useTransition();
  const [equipmentDraft, setEquipmentDraft] = React.useState('');

  const form = useForm<GymConfigInput>({
    resolver: zodResolver(gymConfigSchema),
    defaultValues: {
      ...(gym?.id ? { id: gym.id } : {}),
      name: gym?.name ?? 'Office gym',
      location: gym?.location ?? '',
      access_start: gym?.access_start?.slice(0, 5) ?? null,
      access_end: gym?.access_end?.slice(0, 5) ?? null,
      available_days: gym?.available_days ?? [1, 2, 3, 4, 5],
      equipment: gym?.equipment ?? [],
    },
  });

  const days = form.watch('available_days');
  const equipment = form.watch('equipment');

  function toggleDay(day: number) {
    const current = new Set(days);
    if (current.has(day)) current.delete(day);
    else current.add(day);
    form.setValue('available_days', [...current].sort());
  }

  function addEquipment() {
    const value = equipmentDraft.trim();
    if (!value || equipment.includes(value)) {
      setEquipmentDraft('');
      return;
    }
    form.setValue('equipment', [...equipment, value]);
    setEquipmentDraft('');
  }

  function onSubmit(values: GymConfigInput) {
    startTransition(async () => {
      const result = await saveGymConfig(values);
      if (result.ok) toast.success('Gym details saved.');
      else toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardContent className="p-5">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="gym-name">Name</Label>
              <Input id="gym-name" {...form.register('name')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gym-location">Location</Label>
              <Input id="gym-location" placeholder="Optional" {...form.register('location')} />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Hours you can use it</legend>
            <p className="text-xs text-muted-foreground">
              Office-gym suggestions stop before this window closes. Leave blank for no limit.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="access-start" className="text-xs">
                  From
                </Label>
                <Input
                  id="access-start"
                  type="time"
                  {...form.register('access_start', {
                    setValueAs: (value) => (value === '' ? null : value),
                  })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="access-end" className="text-xs">
                  Until
                </Label>
                <Input
                  id="access-end"
                  type="time"
                  {...form.register('access_end', {
                    setValueAs: (value) => (value === '' ? null : value),
                  })}
                />
                {form.formState.errors.access_end ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.access_end.message}
                  </p>
                ) : null}
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Days available</legend>
            <div className="flex flex-wrap gap-1.5">
              {DAY_NAMES.map((name, index) => {
                const active = days.includes(index);
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

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Equipment</legend>
            <div className="flex gap-2">
              <Input
                value={equipmentDraft}
                placeholder="e.g. cable machine"
                onChange={(event) => setEquipmentDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addEquipment();
                  }
                }}
                aria-label="Add equipment"
              />
              <Button type="button" variant="outline" onClick={addEquipment}>
                Add
              </Button>
            </div>
            {equipment.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {equipment.map((item) => (
                  <li key={item}>
                    <button
                      type="button"
                      onClick={() =>
                        form.setValue(
                          'equipment',
                          equipment.filter((entry) => entry !== item),
                        )
                      }
                      className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/70"
                      aria-label={`Remove ${item}`}
                    >
                      {item}
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </fieldset>

          <Button type="submit" variant="brand" disabled={pending} className="w-full sm:w-auto">
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Save gym
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
