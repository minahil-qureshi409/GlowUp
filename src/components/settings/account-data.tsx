'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Download, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { deleteMyAccount } from '@/server/actions/account';

/**
 * Export and delete.
 *
 * Both are legal requirements for an app holding health data, and both are the
 * kind of thing that gets built as a support-ticket workflow. They are here,
 * self-service, two clicks from the profile.
 */
export function AccountData() {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteMyAccount(confirmation);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success('Your account and everything in it has been deleted.');
      setConfirming(false);
      router.push('/login');
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div>
          <h2 className="text-sm font-medium">Your data</h2>
          <p className="text-xs text-muted-foreground">
            It is yours. Take it with you, or take it away.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/*
            A plain link, not fetch-then-blob: the browser handles the download,
            the file never sits in memory, and it works with the page's CSP.
          */}
          <Button variant="outline" size="sm" asChild>
            <a href="/api/account/export" download>
              <Download aria-hidden="true" />
              Export my data
            </a>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => {
              setConfirmation('');
              setError(null);
              setConfirming(true);
            }}
          >
            <Trash2 aria-hidden="true" />
            Delete my account
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          The export is a JSON file of everything you have logged. Photo files are downloaded
          separately from Progress → Photos.
        </p>
      </CardContent>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes every weigh-in, workout, habit, routine and progress photo, disconnects
            any calendar, and deletes your login. It cannot be undone, and support cannot restore
            it. Export your data first if you might want it.
          </AlertDialogDescription>

          <div className="space-y-1.5">
            <Label htmlFor="delete-confirmation">Type DELETE to confirm</Label>
            <Input
              id="delete-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'delete-confirmation-error' : undefined}
            />
            {error ? (
              <p id="delete-confirmation-error" role="alert" className="text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep my account</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={remove}
              disabled={pending || confirmation.trim().toUpperCase() !== 'DELETE'}
            >
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Delete everything
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
