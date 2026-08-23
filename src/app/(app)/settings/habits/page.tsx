import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { HabitManager } from '@/components/settings/habit-manager';

import { requireUser } from '@/server/auth';
import { getAllHabits } from '@/services/habits';
import { getRecipes } from '@/services/nutrition';

export const metadata: Metadata = { title: 'Habits' };
export const dynamic = 'force-dynamic';

export default async function HabitSettingsPage() {
  const { supabase, userId } = await requireUser();
  const [habits, recipes] = await Promise.all([
    getAllHabits(supabase, userId),
    getRecipes(supabase, userId),
  ]);

  return (
    <div className="animate-fade-up space-y-5 py-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/settings" aria-label="Back to settings">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight">Daily habits</h1>
          <p className="text-xs text-muted-foreground">
            Order sets how they appear on Today. Nothing here is a schedule.
          </p>
        </div>
      </div>

      <HabitManager habits={habits} recipes={recipes} />
    </div>
  );
}
