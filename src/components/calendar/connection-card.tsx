'use client';

import * as React from 'react';
import { CheckCircle2, EyeOff, Link2, Loader2, RefreshCw, ShieldCheck, Unlink } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { disconnect, syncCalendar } from '@/server/actions/calendar';
import type { CalendarConnection } from '@/services/calendar';
import type { ProviderSummary } from '@/lib/calendar/registry';
import { formatDateKey, toUserDate } from '@/lib/date';

type ConnectionCardProps = {
  provider: ProviderSummary;
  connection: CalendarConnection | null;
  /** Used to render "last checked" as the user's day, not the server's. */
  timezone: string;
};

/**
 * One provider's connection state.
 *
 * The permission summary is shown *before* connecting, not buried in a settings
 * screen afterwards — the user should know exactly what the app will be able to
 * see before they grant anything.
 */
export function ConnectionCard({ provider, connection, timezone }: ConnectionCardProps) {
  const [confirmingDisconnect, setConfirmingDisconnect] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const connected = connection?.status === 'connected';
  const needsReconnect = connection?.status === 'expired' || connection?.status === 'error';

  function sync() {
    startTransition(async () => {
      const result = await syncCalendar(provider.id);
      if (result.ok) {
        toast.success(
          result.data.synced === 0
            ? 'Nothing busy in the next two weeks.'
            : `Updated ${result.data.synced} busy blocks.`,
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await disconnect(provider.id);
      if (result.ok) {
        toast.success(
          provider.manageAccessUrl && provider.id === 'outlook'
            ? 'Disconnected. Remove GlowUp at myapps.microsoft.com to clear the consent too.'
            : 'Calendar disconnected.',
        );
      }
      else toast.error(result.error);
      setConfirmingDisconnect(false);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-medium">{provider.label}</h2>
              {connected ? (
                <Badge variant="success">
                  <CheckCircle2 aria-hidden="true" />
                  Connected
                </Badge>
              ) : needsReconnect ? (
                <Badge variant="warning">Needs reconnecting</Badge>
              ) : !provider.available ? (
                <Badge variant="muted">Coming later</Badge>
              ) : !provider.configured ? (
                <Badge variant="muted">Not configured</Badge>
              ) : null}
            </div>

            {connection?.account_email ? (
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {connected ? 'Connected as ' : ''}
                {connection.account_email}
              </p>
            ) : null}

            {connection?.last_synced_at ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {/* The stored value is an instant; the day shown is the user's. */}
                Last checked {formatDateKey(toUserDate(connection.last_synced_at, timezone), 'd MMM')}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 rounded-xl bg-muted/50 p-3.5">
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>{provider.permissionSummary}</span>
          </p>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <EyeOff className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>
              GlowUp stores only start and end times of busy blocks, for the next two weeks. Event
              names and details are never requested and never saved.
            </span>
          </p>
        </div>

        {needsReconnect ? (
          <div
            role="alert"
            className="space-y-1 rounded-lg bg-warning/10 px-3 py-2 text-xs text-foreground"
          >
            <p className="font-medium">This connection needs reauthorising.</p>
            <p className="text-muted-foreground">
              {connection?.last_error ??
                'Access was withdrawn or has expired. Reconnect and busy times will start updating again.'}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {connected ? (
            <>
              <Button variant="outline" size="sm" onClick={sync} disabled={pending}>
                {pending ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw aria-hidden="true" />
                )}
                Refresh
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => setConfirmingDisconnect(true)}
                disabled={pending}
              >
                <Unlink aria-hidden="true" />
                Disconnect
              </Button>
            </>
          ) : provider.available && provider.configured ? (
            <Button variant="brand" size="sm" asChild>
              <a href={`/api/calendar/${provider.id}/connect`}>
                <Link2 aria-hidden="true" />
                {needsReconnect ? 'Reconnect' : 'Connect'}
              </a>
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              {provider.available
                ? 'This deployment has no credentials configured for this provider yet.'
                : 'Planned. It will use the same busy-times-only access.'}
            </p>
          )}
        </div>
      </CardContent>

      <AlertDialog open={confirmingDisconnect} onOpenChange={setConfirmingDisconnect}>
        <AlertDialogContent>
          <AlertDialogTitle>Disconnect {provider.label}?</AlertDialogTitle>
          <AlertDialogDescription>
            Every stored token and every cached busy block is deleted, and suggestions fall back to
            your typical work hours. You can reconnect any time.
            {provider.id === 'outlook' ? (
              <>
                {' '}
                Microsoft offers no way for an app to revoke its own access, so remove GlowUp at{' '}
                <span className="font-medium">myapps.microsoft.com</span> as well if you want the
                consent gone from your account too.
              </>
            ) : null}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Disconnect</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
