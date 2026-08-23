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
  reorderRoutineSteps,
  saveRoutineStep,
  setRoutineStepActive,
} from '@/server/actions/skincare';
import { routineStepFormSchema, type RoutineStepFormInput } from '@/lib/validation/schemas';
import type { Enums } from '@/lib/db/database.types';
import type { RoutineWithSteps } from '@/services/skincare';
import {
  PERIOD_LABELS,
  PRODUCT_CATEGORY_LABELS,
  stepLabel,
  type StepWithProduct,
} from '@/lib/domain/skincare';

type RoutineStepManagerProps = {
  routines: RoutineWithSteps[];
  /** Onboarding shows a tighter version: no retired section, softer copy. */
  compact?: boolean;
};

const CATEGORY_BY_STEP_NAME: Record<string, Enums<'skincare_product_category'>> = {
  cleanser: 'cleanser',
  toner: 'toner',
  serum: 'serum',
  treatment: 'treatment',
  moisturiser: 'moisturizer',
  moisturizer: 'moisturizer',
  spf: 'spf',
  sunscreen: 'spf',
};

/**
 * Skincare routine management.
 *
 * Deliberately the same shape as `/settings/habits`: move up, move down, edit,
 * retire, and one "Add step" per list. Two screens that do the same job should
 * not need to be learned twice.
 *
 * Retiring rather than deleting is the same trade as habits, for the same
 * reason — the step's past completions are part of someone's record, and a
 * product they stopped using two months ago should not erase the two months
 * they did use it.
 */
export function RoutineStepManager({ routines, compact = false }: RoutineStepManagerProps) {
  const [editing, setEditing] = React.useState<{
    period: Enums<'skincare_period'>;
    step: StepWithProduct | null;
  } | null>(null);
  const [pending, startTransition] = React.useTransition();

  const ordered = (['am', 'pm'] as const)
    .map((period) => routines.find((routine) => routine.period === period))
    .filter((routine): routine is RoutineWithSteps => Boolean(routine));

  function move(steps: StepWithProduct[], index: number, direction: -1 | 1) {
    const next = [...steps];
    const target = index + direction;
    const item = next[index];
    const swap = next[target];
    if (!item || !swap) return;
    next[index] = swap;
    next[target] = item;

    startTransition(async () => {
      const result = await reorderRoutineSteps(next.map((step) => step.id));
      if (!result.ok) toast.error(result.error);
    });
  }

  function toggleActive(step: StepWithProduct, isActive: boolean) {
    startTransition(async () => {
      const result = await setRoutineStepActive(step.id, isActive);
      if (result.ok) {
        toast.success(isActive ? 'Step is back.' : 'Step retired — your history is kept.');
      } else {
        toast.error(result.error);
      }
    });
  }

  if (ordered.length === 0) {
    return (
      <p className="rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground">
        No routines yet. They are created with your account — try reloading.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {ordered.map((routine) => {
        const active = routine.steps.filter((step) => step.is_active);
        const retired = routine.steps.filter((step) => !step.is_active);

        return (
          <section key={routine.id} className="space-y-2">
            <h2 className="px-1 text-sm font-semibold">{PERIOD_LABELS[routine.period]}</h2>

            {active.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">
                Nothing in this routine yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {active.map((step, index) => (
                  <li key={step.id}>
                    <Card>
                      <CardContent className="flex items-center gap-2 p-3">
                        <div className="flex flex-col">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="size-7 text-muted-foreground"
                            disabled={index === 0 || pending}
                            onClick={() => move(active, index, -1)}
                            aria-label={`Move ${stepLabel(step)} up`}
                          >
                            <ArrowUp className="size-3.5" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="size-7 text-muted-foreground"
                            disabled={index === active.length - 1 || pending}
                            onClick={() => move(active, index, 1)}
                            aria-label={`Move ${stepLabel(step)} down`}
                          >
                            <ArrowDown className="size-3.5" aria-hidden="true" />
                          </Button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setEditing({ period: routine.period, step })}
                          aria-label={`Edit ${stepLabel(step)}`}
                          className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="flex flex-wrap items-center gap-2">
                            {/* Product names run long; wrapping beats clipping. */}
                            <span className="break-words text-sm font-medium">
                              {stepLabel(step)}
                            </span>
                            {step.is_optional ? <Badge variant="muted">Optional</Badge> : null}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {step.product
                              ? PRODUCT_CATEGORY_LABELS[step.product.category]
                              : 'No product named yet'}
                            {step.product && step.label ? ` · ${step.label}` : ''}
                          </span>
                        </button>

                        <Switch
                          checked
                          disabled={pending}
                          onCheckedChange={() => toggleActive(step, false)}
                          aria-label={`Retire ${stepLabel(step)}`}
                        />
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}

            <Button
              variant="outline"
              className="w-full"
              disabled={pending}
              onClick={() => setEditing({ period: routine.period, step: null })}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add a {PERIOD_LABELS[routine.period].toLowerCase()} step
            </Button>

            {!compact && retired.length > 0 ? (
              <div className="space-y-2 pt-1">
                <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Retired
                </h3>
                <p className="px-1 text-xs text-muted-foreground">
                  Not shown day to day. Their history still counts, and turning one back on
                  restores it.
                </p>
                <ul className="space-y-2">
                  {retired.map((step) => (
                    <li key={step.id}>
                      <Card>
                        <CardContent className="flex items-center gap-3 p-3">
                          <span className="min-w-0 flex-1 break-words px-2 text-sm text-muted-foreground">
                            {stepLabel(step)}
                          </span>
                          <Switch
                            checked={false}
                            disabled={pending}
                            onCheckedChange={() => toggleActive(step, true)}
                            aria-label={`Bring back ${stepLabel(step)}`}
                          />
                        </CardContent>
                      </Card>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        );
      })}

      <p className="px-1 text-xs text-muted-foreground">
        Optional steps never count against your consistency — mark anything you only sometimes use.
      </p>

      <StepDialog
        open={editing !== null}
        period={editing?.period ?? 'am'}
        step={editing?.step ?? null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
    </div>
  );
}

function StepDialog({
  open,
  period,
  step,
  onOpenChange,
}: {
  open: boolean;
  period: Enums<'skincare_period'>;
  step: StepWithProduct | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [formError, setFormError] = React.useState<string | null>(null);

  const form = useForm<RoutineStepFormInput>({
    resolver: zodResolver(routineStepFormSchema),
    defaultValues: {
      period,
      name: '',
      brand: null,
      category: 'other',
      note: null,
      is_optional: false,
    },
  });

  React.useEffect(() => {
    if (!open) return;
    setFormError(null);

    if (!step) {
      form.reset({
        period,
        name: '',
        brand: null,
        category: 'other',
        note: null,
        is_optional: false,
      });
      return;
    }

    // A seeded step has no product yet — its generic label ("Cleanser") is the
    // best first guess at both the name and the category.
    const seededName = step.product?.name ?? step.label ?? '';
    form.reset({
      id: step.id,
      period,
      name: seededName,
      brand: step.product?.brand ?? null,
      category:
        step.product?.category ??
        CATEGORY_BY_STEP_NAME[seededName.trim().toLowerCase()] ??
        'other',
      note: step.product ? (step.label ?? null) : null,
      is_optional: step.is_optional,
    });
  }, [open, step, period, form]);

  function onSubmit(values: RoutineStepFormInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await saveRoutineStep(values);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success(step ? 'Step updated.' : 'Step added.');
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{step ? 'Edit step' : 'New step'}</DialogTitle>
          <DialogDescription>
            {PERIOD_LABELS[period]} routine. Order is set on the previous screen.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="step-name">Product or step</Label>
            <Input
              id="step-name"
              placeholder="e.g. Gentle gel cleanser"
              aria-invalid={Boolean(form.formState.errors.name)}
              aria-describedby={form.formState.errors.name ? 'step-name-error' : undefined}
              {...form.register('name')}
            />
            {form.formState.errors.name ? (
              <p id="step-name-error" className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="step-brand">Brand (optional)</Label>
              <Input
                id="step-brand"
                {...form.register('brand', {
                  setValueAs: (value) => (value === '' ? null : value),
                })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="step-category">Type</Label>
              <Select
                value={form.watch('category')}
                onValueChange={(value) =>
                  form.setValue('category', value as RoutineStepFormInput['category'])
                }
              >
                <SelectTrigger id="step-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRODUCT_CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="step-note">Note (optional)</Label>
            <Input
              id="step-note"
              placeholder="e.g. Cleanse or rinse"
              {...form.register('note', {
                setValueAs: (value) => (value === '' ? null : value),
              })}
            />
            <p className="text-xs text-muted-foreground">
              Shown in small text under the step on your routine.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
            <div>
              <Label htmlFor="step-optional">Optional</Label>
              <p className="text-xs text-muted-foreground">
                Never counted as missed, and excluded from consistency.
              </p>
            </div>
            <Switch
              id="step-optional"
              checked={form.watch('is_optional')}
              onCheckedChange={(checked) => form.setValue('is_optional', checked)}
            />
          </div>

          {formError ? (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
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
