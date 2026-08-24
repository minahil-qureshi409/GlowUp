import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PhotoGallery } from '@/components/progress/photo-gallery';

import { requireUser } from '@/server/auth';
import { getUserContext } from '@/services/profile';
import { getProgressPhotos } from '@/services/progress';
import { todayIn } from '@/lib/date';

export const metadata: Metadata = { title: 'Progress photos' };
export const dynamic = 'force-dynamic';

export default async function ProgressPhotosPage() {
  const { supabase, userId } = await requireUser();
  const context = await getUserContext(supabase, userId);
  const today = todayIn(context.profile.timezone);

  const photos = await getProgressPhotos(supabase, userId, { limit: 120 });

  return (
    <div className="animate-fade-up space-y-5 py-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/progress" aria-label="Back to progress">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-xl tracking-tight">Progress photos</h1>
          <p className="text-xs text-muted-foreground">Optional, private, and entirely yours.</p>
        </div>
      </div>

      <PhotoGallery photos={photos} today={today} />
    </div>
  );
}
