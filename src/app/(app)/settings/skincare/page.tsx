import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { RoutineStepManager } from '@/components/skincare/routine-step-manager';

import { requireUser } from '@/server/auth';
import { getRoutinesWithRetired } from '@/services/skincare';

export const metadata: Metadata = { title: 'Skincare routines' };
export const dynamic = 'force-dynamic';

export default async function SkincareSettingsPage() {
  const { supabase, userId } = await requireUser();
  const routines = await getRoutinesWithRetired(supabase, userId);

  return (
    <div className="animate-fade-up space-y-5 py-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/settings" aria-label="Back to settings">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-xl tracking-tight">
            Skincare products &amp; routines
          </h1>
          <p className="text-xs text-muted-foreground">
            Order sets how the steps appear on Skincare and Today.
          </p>
        </div>
      </div>

      <RoutineStepManager routines={routines} />
    </div>
  );
}
