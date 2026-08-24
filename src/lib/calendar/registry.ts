import 'server-only';

import type { Enums } from '@/lib/db/database.types';
import { googleCalendarProvider } from '@/lib/calendar/google';
import { CalendarError, type CalendarProvider } from '@/lib/calendar/types';

/**
 * Provider registry.
 *
 * Google is the only one. Apple needs a paid developer account, and Outlook
 * needs a per-deployment Entra ID registration plus a tenant decision — and
 * Microsoft has no free/busy-only scope, so the narrowest grant it offers is
 * `Calendars.Read`, which is a wider promise than this app is willing to make.
 *
 * The registry stays a registry rather than collapsing into a single hard-coded
 * provider: routes, services and UI all address providers by id, so adding
 * another later means writing one module that satisfies `CalendarProvider`,
 * adding its id to the database enum, and adding a line here.
 */
const PROVIDERS: Partial<Record<Enums<'calendar_provider'>, CalendarProvider>> = {
  google: googleCalendarProvider,
};

/** Ids that map to a real implementation. Used to validate a route param. */
export const IMPLEMENTED_PROVIDER_IDS = Object.keys(PROVIDERS) as Enums<'calendar_provider'>[];

export function isProviderId(value: string): value is Enums<'calendar_provider'> {
  return (IMPLEMENTED_PROVIDER_IDS as string[]).includes(value);
}

export function getProvider(id: Enums<'calendar_provider'>): CalendarProvider {
  const provider = PROVIDERS[id];
  if (!provider) {
    throw new CalendarError('unavailable', `Calendar provider "${id}" is not implemented.`);
  }
  return provider;
}

export type ProviderSummary = {
  id: Enums<'calendar_provider'>;
  label: string;
  configured: boolean;
  available: boolean;
  permissionSummary: string;
  manageAccessUrl: string | null;
};

/**
 * Every implemented provider the UI shows.
 *
 * `configured` reads the environment, so a deployment with no Google
 * credentials shows the honest "Not configured" state instead of a Connect
 * button that would fail on click.
 */
export function listProviders(): ProviderSummary[] {
  return IMPLEMENTED_PROVIDER_IDS.map((id) => {
    const provider = getProvider(id);
    return {
      id,
      label: provider.label,
      configured: provider.isConfigured(),
      available: true,
      permissionSummary: provider.permissionSummary,
      manageAccessUrl: provider.manageAccessUrl,
    };
  });
}
