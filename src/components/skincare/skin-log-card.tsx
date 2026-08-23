'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { saveSkinLog } from '@/server/actions/skincare';
import type { Enums } from '@/lib/db/database.types';
import { SKIN_CONDITION_LABELS } from '@/lib/domain/skincare';
import { cn } from '@/lib/utils';

type SkinLogCardProps = {
  date: string;
  conditions: Enums<'skin_condition'>[];
  note: string | null;
};

const ALL_CONDITIONS = Object.keys(SKIN_CONDITION_LABELS) as Enums<'skin_condition'>[];

/**
 * How skin felt today.
 *
 * Multi-select, because skin is rarely one thing. The app records what the user
 * says and never interprets it — no "your breakouts correlate with X", no
 * product blame, no diagnosis.
 */
export function SkinLogCard({ date, conditions: initial, note: initialNote }: SkinLogCardProps) {
  const [selected, setSelected] = React.useState<Enums<'skin_condition'>[]>(initial);
  const [note, setNote] = React.useState(initialNote ?? '');
  const [pending, startTransition] = React.useTransition();

  const dirty =
    note !== (initialNote ?? '') ||
    selected.length !== initial.length ||
    selected.some((condition) => !initial.includes(condition));

  function toggle(condition: Enums<'skin_condition'>) {
    setSelected((current) =>
      current.includes(condition)
        ? current.filter((item) => item !== condition)
        : [...current, condition],
    );
  }

  function save() {
    startTransition(async () => {
      const result = await saveSkinLog({ log_date: date, conditions: selected, note: note || null });
      if (result.ok) toast.success('Noted.');
      else toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div>
          <h2 className="text-sm font-semibold">How is your skin today?</h2>
          <p className="text-xs text-muted-foreground">Optional. Pick anything that fits.</p>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Skin condition">
          {ALL_CONDITIONS.map((condition) => {
            const active = selected.includes(condition);
            return (
              <button
                key={condition}
                type="button"
                onClick={() => toggle(condition)}
                aria-pressed={active}
                className={cn(
                  'min-h-9 rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted/60',
                )}
              >
                {SKIN_CONDITION_LABELS[condition]}
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="skin-note">Notes</Label>
          <Textarea
            id="skin-note"
            rows={2}
            value={note}
            maxLength={400}
            placeholder="Anything worth remembering"
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

        <Button onClick={save} disabled={!dirty || pending} className="w-full" variant="outline">
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Save note
        </Button>
      </CardContent>
    </Card>
  );
}
