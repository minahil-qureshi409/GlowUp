'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createHabit,
  reorderHabits,
  setHabitActive,
  updateHabit,
} from '@/server/actions/habits';
import { habitSchema, type HabitInput } from '@/lib/validation/schemas';
import type { Habit } from '@/services/habits';
import type { RecipeWithIngredients } from '@/services/nutrition';

type HabitManagerProps = {
  habits: Habit[];
  recipes: RecipeWithIngredients[];
};

const CATEGORY_LABELS: Record<HabitInput['category'], string> = {
  nutrition: 'Nutrition',
  skincare: 'Skincare',
  workout: 'Workout',
  recovery: 'Recovery',
  custom: 'Other',
};

const PART_LABELS: Record<HabitInput['preferred_part'], string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  anytime: 'Any time',
};

/**
 * Habit management.
 *
 * Retiring a habit deactivates it rather than deleting it, so past weeks keep
 * adding up and turning it back on restores its history. That is why there is
 * no delete button here.
 */
export function HabitManager({ habits, recipes }: HabitManagerProps) {
  const [editing, setEditing] = React.useState<Habit | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const active = habits.filter((habit) => habit.is_active);
  const retired = habits.filter((habit) => !habit.is_active);

  function move(index: number, direction: -1 | 1) {
    const next = [...active];
    const target = index + direction;
    const item = next[index];
    const swap = next[target];
    if (!item || !swap) return;
    next[index] = swap;
    next[target] = item;

    startTransition(async () => {
      const result = await reorderHabits(next.map((habit) => habit.id));
      if (!result.ok) toast.error(result.error);
    });
  }

  function toggleActive(habit: Habit, isActive: boolean) {
    startTransition(async () => {
      const result = await setHabitActive(habit.id, isActive);
      if (result.ok) {
        toast.success(isActive ? 'Habit is back.' : 'Habit retired — your history is kept.');
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {active.map((habit, index) => (
          <li key={habit.id}>
            <Card>
              <CardContent className="flex items-center gap-2 p-3">
                <div className="flex flex-col">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 text-muted-foreground"
                    disabled={index === 0 || pending}
                    onClick={() => move(index, -1)}
                    aria-label={`Move ${habit.name} up`}
                  >
                    <ArrowUp className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 text-muted-foreground"
                    disabled={index === active.length - 1 || pending}
                    onClick={() => move(index, 1)}
                    aria-label={`Move ${habit.name} down`}
                  >
                    <ArrowDown className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>

                <button
                  type="button"
                  onClick={() => setEditing(habit)}
                  aria-label={`Edit ${habit.name}`}
                  className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{habit.name}</span>
                    {habit.is_optional ? <Badge variant="muted">Optional</Badge> : null}
                    {habit.frequency === 'weekly' ? (
                      <Badge variant="outline">{habit.target_per_week}× a week</Badge>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {CATEGORY_LABELS[habit.category]} · {PART_LABELS[habit.preferred_part]}
                    {habit.reminder_enabled ? ' · reminders on' : ''}
                  </span>
                </button>

                <Switch
                  checked
                  disabled={pending}
                  onCheckedChange={() => toggleActive(habit, false)}
                  aria-label={`Retire ${habit.name}`}
                />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <Button variant="outline" className="w-full" onClick={() => setCreating(true)}>
        <Plus className="size-4" aria-hidden="true" />
        New habit
      </Button>

      {retired.length > 0 ? (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-semibold">Retired</h2>
          <p className="px-1 text-xs text-muted-foreground">
            Not shown day to day. Their history is kept, and turning one back on restores it.
          </p>
          <ul className="space-y-2">
            {retired.map((habit) => (
              <li key={habit.id}>
                <Card>
                  <CardContent className="flex items-center gap-3 p-3">
                    <span className="min-w-0 flex-1 truncate px-2 text-sm text-muted-foreground">
                      {habit.name}
                    </span>
                    <Switch
                      checked={false}
                      disabled={pending}
                      onCheckedChange={() => toggleActive(habit, true)}
                      aria-label={`Bring back ${habit.name}`}
                    />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <HabitDialog
        open={creating || editing !== null}
        habit={editing}
        recipes={recipes}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      />
    </div>
  );
}

function HabitDialog({
  open,
  habit,
  recipes,
  onOpenChange,
}: {
  open: boolean;
  habit: Habit | null;
  recipes: RecipeWithIngredients[];
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [formError, setFormError] = React.useState<string | null>(null);

  const form = useForm<HabitInput>({
    resolver: zodResolver(habitSchema),
    defaultValues: {
      name: '',
      category: 'custom',
      frequency: 'daily',
      target_per_week: null,
      preferred_part: 'anytime',
      window_start: null,
      window_end: null,
      reminder_enabled: false,
      is_optional: false,
      recipe_id: null,
    },
  });

  React.useEffect(() => {
    if (!open) return;
    if (habit) {
      form.reset({
        id: habit.id,
        name: habit.name,
        category: habit.category,
        icon: habit.icon,
        frequency: habit.frequency,
        target_per_week: habit.target_per_week,
        preferred_part: habit.preferred_part,
        window_start: habit.window_start?.slice(0, 5) ?? null,
        window_end: habit.window_end?.slice(0, 5) ?? null,
        reminder_enabled: habit.reminder_enabled,
        is_optional: habit.is_optional,
        recipe_id: habit.recipe_id,
      });
    } else {
      form.reset({
        name: '',
        category: 'custom',
        frequency: 'daily',
        target_per_week: null,
        preferred_part: 'anytime',
        window_start: null,
        window_end: null,
        reminder_enabled: false,
        is_optional: false,
        recipe_id: null,
      });
    }
  }, [open, habit, form]);

  const frequency = form.watch('frequency');
  const category = form.watch('category');

  function onSubmit(values: HabitInput) {
    setFormError(null);
    startTransition(async () => {
      const result = habit ? await updateHabit(values) : await createHabit(values);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success(habit ? 'Habit updated.' : 'Habit added.');
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{habit ? 'Edit habit' : 'New habit'}</DialogTitle>
          <DialogDescription>
            Preferred times are hints for ordering and reminders, never deadlines.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="habit-name">Name</Label>
            <Input id="habit-name" {...form.register('name')} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="habit-category">Category</Label>
              <Select
                value={category}
                onValueChange={(value) =>
                  form.setValue('category', value as HabitInput['category'])
                }
              >
                <SelectTrigger id="habit-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="habit-part">Usually happens</Label>
              <Select
                value={form.watch('preferred_part')}
                onValueChange={(value) =>
                  form.setValue('preferred_part', value as HabitInput['preferred_part'])
                }
              >
                <SelectTrigger id="habit-part">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PART_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="habit-frequency">Frequency</Label>
              <Select
                value={frequency}
                onValueChange={(value) => {
                  form.setValue('frequency', value as HabitInput['frequency']);
                  if (value !== 'weekly') form.setValue('target_per_week', null);
                  else form.setValue('target_per_week', 3);
                }}
              >
                <SelectTrigger id="habit-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Every day</SelectItem>
                  <SelectItem value="weekly">A few times a week</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {frequency === 'weekly' ? (
              <div className="space-y-1.5">
                <Label htmlFor="habit-target">Times per week</Label>
                <Input
                  id="habit-target"
                  type="number"
                  min={1}
                  max={21}
                  inputMode="numeric"
                  {...form.register('target_per_week', {
                    setValueAs: (value) => (value === '' ? null : Number(value)),
                  })}
                />
              </div>
            ) : null}
          </div>

          {category === 'nutrition' && recipes.length > 0 ? (
            <div className="space-y-1.5">
              <Label htmlFor="habit-recipe">Linked recipe (optional)</Label>
              <Select
                value={form.watch('recipe_id') ?? 'none'}
                onValueChange={(value) =>
                  form.setValue('recipe_id', value === 'none' ? null : value)
                }
              >
                <SelectTrigger id="habit-recipe">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No recipe</SelectItem>
                  {recipes.map((recipe) => (
                    <SelectItem key={recipe.id} value={recipe.id}>
                      {recipe.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
            <div>
              <Label htmlFor="habit-optional">Optional</Label>
              <p className="text-xs text-muted-foreground">
                Never counted as missed, and excluded from consistency.
              </p>
            </div>
            <Switch
              id="habit-optional"
              checked={form.watch('is_optional')}
              onCheckedChange={(checked) => form.setValue('is_optional', checked)}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
            <div>
              <Label htmlFor="habit-reminder">Reminders</Label>
              <p className="text-xs text-muted-foreground">
                Only if it is still unlogged, and never during a meeting.
              </p>
            </div>
            <Switch
              id="habit-reminder"
              checked={form.watch('reminder_enabled')}
              onCheckedChange={(checked) => form.setValue('reminder_enabled', checked)}
            />
          </div>

          {formError ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
