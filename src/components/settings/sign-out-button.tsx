'use client';

import { LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { clearServiceWorkerCaches } from '@/components/pwa/service-worker';

export function SignOutButton() {
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // The worker caches nothing personal by design; this is the belt to that
    // braces, and sign-out is the moment to be certain.
    await clearServiceWorkerCaches();
    // A full navigation rather than a router push, so no server-rendered page
    // is left holding the previous session's data.
    window.location.href = '/login';
  }

  return (
    <Button variant="outline" size="sm" onClick={() => void signOut()}>
      <LogOut className="size-4" />
      Sign out
    </Button>
  );
}
