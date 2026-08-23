import 'server-only';

import type { Enums } from '@/lib/db/database.types';
import { googleCalendarProvider } from '@/lib/calendar/google';
import { microsoftCalendarProvider } from '@/lib/calendar/microsoft';
import { CalendarError, type CalendarProvider } from '@/lib/calendar/types';

/**
 * Provider registry.
 *
 * Adding Apple later means writing one module that satisfies `CalendarProvider`
 * and adding it here — nothing in the routes, services or UI changes, because
 * they all address providers by id.
 */
const PROVIDERS: Partial<Record<Enums<'calendar_provider'>, CalendarProvider>> = {
  google: googleCalendarProvider,
  outlook: microsoftCalendarProvider,
};

/** Ids that map to a real implementation. Used to validate a route param. */
export const IMPLEMENTED_PROVIDER_IDS = Object.keys(PROVIDERS) as Enums<'calendar_provider'>[];

export function isProviderId(value: string): value is Enums<'calendar_provider'> {
  return (IMPLEMENTED_PROVIDER_IDS as string[]).includes(value);
}

export function getProvider(id: Enums<'calendar_provider'>): CalendarProvider {
  const provider = PROVIDERS[id];
  if (!provider) {
    throw new CalendarError('unavailable', `Calendar provider "${id}" is not implemented yet.`);
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
 * Every provider the UI shows, implemented or not.
 *
 * `configured` reads the environment, so a deployment with no Microsoft
 * credentials shows the honest "Not configured" state instead of a Connect
 * button that would fail on click.
 */
export function listProviders(): ProviderSummary[] {
  const summaries: ProviderSummary[] = IMPLEMENTED_PROVIDER_IDS.map((id) => {
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

  summaries.push({
    id: 'apple',
    label: 'Apple Calendar',
    configured: false,
    available: false,
    permissionSummary: 'Planned. It will use the same busy-times-only access.',
    manageAccessUrl: null,
  });

  return summaries;
}
