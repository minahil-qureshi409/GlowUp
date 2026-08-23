'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Home, Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { startWorkout } from '@/server/actions/workouts';
import type { Enums } from '@/lib/db/database.types';
import type { TemplateWithExercises } from '@/services/workouts';
import { cn } from '@/lib/utils';

type StartWorkoutProps = {
  templates: TemplateWithExercises[];
  today: string;
  /**
   * Whether the office gym is reachable right now. When false the option is
   * disabled with the reason shown, rather than hidden — the user should be able
   * to see *why* it isn't on offer.
   */
  officeGym: { name: string; available: boolean; reason: string | null } | null;
};

export function StartWorkout({ templates, today, officeGym }: StartWorkoutProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const suggestedLocation = searchParams.get('location');
  const [location, setLocation] = React.useState<Enums<'workout_location'>>(
    suggestedLocation === 'office_gym' && officeGym?.available ? 'office_gym' : 'home',
  );
  const [templateId, setTemplateId] = React.useState<string | null>(templates[0]?.id ?? null);
  const [customName, setCustomName] = React.useState('');

  // Arriving from a dashboard suggestion opens the sheet straight away.
  React.useEffect(() => {
    if (suggestedLocation) setOpen(true);
  }, [suggestedLocation]);

  function begin() {
    const template = templates.find((t) => t.id === templateId) ?? null;
    const name = template?.name ?? (customName.trim() || 'Workout');

    startTransition(async () => {
      const result = await startWorkout({
        template_id: template?.id ?? null,
        name,
        workout_date: today,
        location,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      router.push(`/workout/session/${result.data.id}`);
    });
  }

  return (
    <>
      <Button variant="brand" className="w-full" onClick={() => setOpen(true)}>
        <Play className="size-4" />
        Start a session
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a session</DialogTitle>
            <DialogDescription>Pick a template or build one as you go.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Where</legend>
              <div className="grid grid-cols-2 gap-2">
                <LocationOption
                  icon={Building2}
                  label={officeGym?.name ?? 'Office gym'}
                  hint={officeGym?.available ? 'Open now' : (officeGym?.reason ?? 'Not set up')}
                  selected={location === 'office_gym'}
                  disabled={!officeGym?.available}
                  onSelect={() => setLocation('office_gym')}
                />
                <LocationOption
                  icon={Home}
                  label="Home"
                  hint="Always available"
                  selected={location === 'home'}
                  onSelect={() => setLocation('home')}
                />
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Session</legend>
              <div className="space-y-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setTemplateId(template.id)}
                    aria-pressed={templateId === template.id}
                    className={cn(
                      'flex w-full flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-left transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      templateId === template.id
                        ? 'border-primary bg-primary-soft'
                        : 'border-border hover:bg-muted/50',
                    )}
                  >
                    <span className="text-sm font-medium">{template.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {template.focus} · {template.exercises.length} exercises
                    </span>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setTemplateId(null)}
                  aria-pressed={templateId === null}
                  className={cn(
                    'flex w-full flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-left transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    templateId === null ? 'border-primary bg-primary-soft' : 'border-border hover:bg-muted/50',
                  )}
                >
                  <span className="text-sm font-medium">Empty session</span>
                  <span className="text-xs text-muted-foreground">Add exercises as you go</span>
                </button>
              </div>
            </fieldset>

            {templateId === null ? (
              <div className="space-y-1.5">
                <Label htmlFor="session-name">Name (optional)</Label>
                <Input
                  id="session-name"
                  value={customName}
                  placeholder="e.g. Quick arms"
                  onChange={(event) => setCustomName(event.target.value)}
                />
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={begin} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Start
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LocationOption({
  icon: Icon,
  label,
  hint,
  selected,
  disabled,
  onSelect,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'flex flex-col items-start gap-1 rounded-xl border px-3.5 py-3 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        selected && !disabled ? 'border-primary bg-primary-soft' : 'border-border hover:bg-muted/50',
      )}
    >
      <Icon className="size-4 text-muted-foreground" />
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}
