'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateProfile } from '@/server/actions/settings';
import { profileSchema, type ProfileInput } from '@/lib/validation/schemas';
import type { Profile } from '@/services/profile';
import { detectTimezone } from '@/lib/date';
import { formatHeightImperial } from '@/lib/format';

const COMMON_TIMEZONES = [
  'UTC',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Istanbul',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
];

export function ProfileForm({ profile }: { profile: Profile }) {
  const { setTheme } = useTheme();
  const [pending, startTransition] = React.useTransition();
  const [detected, setDetected] = React.useState<string | null>(null);

  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: profile.display_name ?? '',
      height_cm: profile.height_cm,
      timezone: profile.timezone,
      time_format: profile.time_format,
      theme: profile.theme,
    },
  });

  React.useEffect(() => {
    const browserTimezone = detectTimezone();
    if (browserTimezone !== profile.timezone) setDetected(browserTimezone);
  }, [profile.timezone]);

  const height = form.watch('height_cm');
  const timezone = form.watch('timezone');

  // Whatever the user has actually set stays selectable even if it is not in
  // the shortlist, so saving never silently changes their timezone.
  const timezoneOptions = React.useMemo(() => {
    const options = new Set(COMMON_TIMEZONES);
    options.add(profile.timezone);
    if (detected) options.add(detected);
    return [...options].sort();
  }, [profile.timezone, detected]);

  function onSubmit(values: ProfileInput) {
    startTransition(async () => {
      const result = await updateProfile(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Keep next-themes in step with the stored preference.
      setTheme(values.theme);
      toast.success('Profile updated.');
    });
  }

  return (
    <Card>
      <CardContent className="p-5">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="display_name">Name</Label>
            <Input id="display_name" {...form.register('display_name')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="height_cm">Height (cm)</Label>
            <Input
              id="height_cm"
              type="number"
              step="0.5"
              inputMode="decimal"
              {...form.register('height_cm', {
                setValueAs: (value) => (value === '' ? null : Number(value)),
              })}
            />
            <p className="text-xs text-muted-foreground">
              {height ? `≈ ${formatHeightImperial(height)}` : 'Used for context only.'}
            </p>
            {form.formState.errors.height_cm ? (
              <p className="text-xs text-destructive">{form.formState.errors.height_cm.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="timezone">Timezone</Label>
            <Select value={timezone} onValueChange={(value) => form.setValue('timezone', value)}>
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timezoneOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {detected && detected !== timezone ? (
              <button
                type="button"
                className="text-xs text-primary underline-offset-4 hover:underline"
                onClick={() => form.setValue('timezone', detected)}
              >
                Your device says {detected.replace(/_/g, ' ')} — use that instead?
              </button>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="time_format">Time format</Label>
              <Select
                value={form.watch('time_format')}
                onValueChange={(value) =>
                  form.setValue('time_format', value as ProfileInput['time_format'])
                }
              >
                <SelectTrigger id="time_format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">12-hour (2:30 PM)</SelectItem>
                  <SelectItem value="24h">24-hour (14:30)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="theme">Theme</Label>
              <Select
                value={form.watch('theme')}
                onValueChange={(value) => form.setValue('theme', value as ProfileInput['theme'])}
              >
                <SelectTrigger id="theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">Match my device</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" variant="brand" disabled={pending} className="w-full sm:w-auto">
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Save profile
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
