import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-4xl tracking-tight">Nothing here</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        That page does not exist. It may have moved, or the link may be out of date.
      </p>
      <Button asChild variant="brand">
        <Link href="/today">Back to today</Link>
      </Button>
    </div>
  );
}
