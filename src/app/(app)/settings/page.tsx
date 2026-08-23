import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, HeartPulse, ListChecks } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/common/page-header';
import { ProfileForm } from '@/components/settings/profile-form';
import { ScheduleForm } from '@/components/settings/schedule-form';
import { GymForm } from '@/components/settings/gym-form';
import { NotificationsForm } from '@/components/settings/notifications-form';
import { GoalForm } from '@/components/settings/goal-form';
import { SignOutButton } from '@/components/settings/sign-out-button';
import { AccountData } from '@/components/settings/account-data';

import { requireUser } from '@/server/auth';
import { getUserContext } from '@/services/profile';
import { getWeightGoal } from '@/services/weight';
import { TONE } from '@/lib/domain/copy';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { supabase, userId, email } = await requireUser();
  const [context, weightGoal] = await Promise.all([
    getUserContext(supabase, userId),
    getWeightGoal(supabase, userId),
  ]);

  return (
    <div className="animate-fade-up space-y-5 py-3">
      <PageHeader title="Settings" description={email ?? undefined} />

      <Tabs defaultValue="you">
        <div className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
          <TabsList>
            <TabsTrigger value="you">You</TabsTrigger>
            <TabsTrigger value="goals">Goals</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="gym">Gym</TabsTrigger>
            <TabsTrigger value="reminders">Reminders</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="you" className="space-y-4">
          <ProfileForm profile={context.profile} />

          <nav aria-label="Content settings">
            <ul className="space-y-2">
              <SettingsLink
                href="/settings/habits"
                icon={ListChecks}
                title="Daily habits"
                description="Add, edit, reorder or retire habits"
              />
              <SettingsLink
                href="/settings/skincare"
                icon={HeartPulse}
                title="Skincare products & routines"
                description="Add, rename, reorder or retire your morning and evening steps"
              />
            </ul>
          </nav>

          <AccountData />

          <Card>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">Sign out</p>
                <p className="truncate text-xs text-muted-foreground">{email}</p>
              </div>
              <SignOutButton />
            </CardContent>
          </Card>

          <div className="space-y-2 px-1 text-xs text-muted-foreground">
            <p>{TONE.notMedical}</p>
            <p>
              <Link href="/legal/privacy" className="underline-offset-4 hover:text-foreground hover:underline">
                Privacy policy
              </Link>
              {' · '}
              <Link href="/legal/terms" className="underline-offset-4 hover:text-foreground hover:underline">
                Terms
              </Link>
            </p>
          </div>
        </TabsContent>

        <TabsContent value="goals">
          <GoalForm goal={weightGoal.goal} milestones={weightGoal.milestones} />
        </TabsContent>

        <TabsContent value="schedule">
          <ScheduleForm settings={context.settings} />
        </TabsContent>

        <TabsContent value="gym">
          <GymForm gym={context.gym} />
        </TabsContent>

        <TabsContent value="reminders" className="space-y-4">
          <NotificationsForm settings={context.settings} />
          <Card>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium">Calendar</p>
                <p className="text-xs text-muted-foreground">
                  {context.calendarConnected ? 'Connected' : 'Not connected'}
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/calendar">Manage</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SettingsLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  description: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 transition-colors hover:bg-muted/50"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{description}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
