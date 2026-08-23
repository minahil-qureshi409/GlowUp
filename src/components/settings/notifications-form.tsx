'use client';

import * as React from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { updateSettings } from '@/server/actions/settings';
import type { UserSettings } from '@/services/profile';

type NotificationsFormProps = {
  settings: UserSettings;
};

/**
 * Reminder preferences.
 *
 * Notifications default to off and require an explicit browser permission grant
 * on top of the toggle — two deliberate steps before the app is allowed to
 * interrupt anyone. Quiet hours and a daily cap are first-class settings rather
 * than buried options, because the failure mode here is nagging.
 */
export function NotificationsForm({ settings }: NotificationsFormProps) {
  const [enabled, setEnabled] = React.useState(settings.notifications_enabled);
  const [quietStart, setQuietStart] = React.useState(settings.quiet_hours_start.slice(0, 5));
  const [quietEnd, setQuietEnd] = React.useState(settings.quiet_hours_end.slice(0, 5));
  const [maxDaily, setMaxDaily] = React.useState(settings.max_daily_reminders);
  const [permission, setPermission] = React.useState<NotificationPermission | 'unsupported'>(
    'default',
  );
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);
  }, []);

  async function toggle(next: boolean) {
    if (next && permission === 'default' && 'Notification' in window) {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') {
        toast('Reminders stay off until your browser allows notifications.');
        return;
      }
    }
    setEnabled(next);
  }

  function save() {
    startTransition(async () => {
      const result = await updateSettings({
        workouts_per_week: settings.workouts_per_week,
        preferred_workout_days: settings.preferred_workout_days,
        typical_work_start: settings.typical_work_start?.slice(0, 5) ?? null,
        typical_work_end: settings.typical_work_end?.slice(0, 5) ?? null,
        commute_minutes: settings.commute_minutes,
        weekly_weigh_in_day: settings.weekly_weigh_in_day,
        notifications_enabled: enabled,
        quiet_hours_start: quietStart,
        quiet_hours_end: quietEnd,
        max_daily_reminders: maxDaily,
        suggestions_enabled: settings.suggestions_enabled,
      });

      if (result.ok) toast.success('Reminder settings saved.');
      else toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="notifications">Reminders</Label>
            <p className="text-xs text-muted-foreground">
              Gentle nudges for things you have not logged yet. Never for things you have.
            </p>
          </div>
          <Switch
            id="notifications"
            checked={enabled}
            disabled={permission === 'unsupported' || permission === 'denied'}
            onCheckedChange={(checked) => void toggle(checked)}
          />
        </div>

        {permission === 'denied' ? (
          <p className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <BellOff className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            Your browser is blocking notifications for this site. Allow them in your browser
            settings to turn reminders on.
          </p>
        ) : permission === 'unsupported' ? (
          <p className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <BellOff className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            This browser does not support notifications. Everything else works as normal.
          </p>
        ) : enabled ? (
          <p className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <Bell className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            Reminders pause during calendar meetings and on long days, and stop entirely once
            you have logged the thing.
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="quiet-start">Quiet from</Label>
            <Input
              id="quiet-start"
              type="time"
              value={quietStart}
              onChange={(event) => setQuietStart(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quiet-end">Quiet until</Label>
            <Input
              id="quiet-end"
              type="time"
              value={quietEnd}
              onChange={(event) => setQuietEnd(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="max-reminders">Most reminders per day</Label>
          <Input
            id="max-reminders"
            type="number"
            min={0}
            max={20}
            inputMode="numeric"
            value={maxDaily}
            onChange={(event) => setMaxDaily(Number(event.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            On a busy day this drops to two, and on a long day to one.
          </p>
        </div>

        <Button variant="brand" onClick={save} disabled={pending} className="w-full sm:w-auto">
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Save reminders
        </Button>
      </CardContent>
    </Card>
  );
}
