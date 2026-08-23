'use client';

import { Loader2, Link2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

type BusyBlock = {
  start: string;
  end: string;
};

export default function AppleConnectButton() {
  const [busyBlocks, setBusyBlocks] = useState<BusyBlock[]>([]);
  const [pending, setPending] = useState(false);

  const handleConnect = async () => {
    setPending(true);
    try {
      const res = await fetch('/api/calendar/apple');
      const data: { busyBlocks?: BusyBlock[]; error?: string } = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Could not connect Apple Calendar.');
      }

      console.log(data.busyBlocks);
      setBusyBlocks(data.busyBlocks ?? []);
      toast.success(`Loaded ${data.busyBlocks?.length ?? 0} busy blocks.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not connect Apple Calendar.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button variant="brand" size="sm" onClick={handleConnect} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Link2 aria-hidden="true" />}
        Connect Apple Calendar
      </Button>
      {busyBlocks.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {busyBlocks.length} busy {busyBlocks.length === 1 ? 'block' : 'blocks'} loaded.
        </p>
      ) : null}
    </div>
  );
}
