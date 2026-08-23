import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shared route-level loading state.
 *
 * Mirrors the common page shape — header, hero card, list — so the transition
 * is a fill-in rather than a layout jump.
 */
export default function Loading() {
  return (
    <div className="space-y-5 py-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      <div className="space-y-2 px-1">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-56" />
      </div>

      <Skeleton className="h-40 w-full rounded-2xl" />

      <div className="space-y-2">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
      </div>
    </div>
  );
}
