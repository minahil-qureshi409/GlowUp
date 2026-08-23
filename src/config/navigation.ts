import {
  CalendarDays,
  Dumbbell,
  Home,
  Settings,
  Sparkles,
  TrendingUp,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shorter label for the bottom bar, where horizontal space is tight. */
  shortLabel?: string;
  /**
   * Bottom navigation is capped at five items — past that the targets get too
   * narrow to hit reliably on a phone. Calendar and Settings are reachable from
   * the header instead, and both appear in full in the desktop sidebar.
   */
  inBottomNav: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: '/today', label: 'Home', icon: Home, inBottomNav: true },
  { href: '/nutrition', label: 'Nutrition', icon: UtensilsCrossed, shortLabel: 'Food', inBottomNav: true },
  { href: '/workout', label: 'Workout', icon: Dumbbell, inBottomNav: true },
  { href: '/skincare', label: 'Skincare', icon: Sparkles, shortLabel: 'Skin', inBottomNav: true },
  { href: '/progress', label: 'Progress', icon: TrendingUp, inBottomNav: true },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays, inBottomNav: false },
  { href: '/settings', label: 'Settings', icon: Settings, inBottomNav: false },
];

export const BOTTOM_NAV_ITEMS = NAV_ITEMS.filter((item) => item.inBottomNav);

/** Longest-prefix match, so `/progress/timeline` still highlights Progress. */
export function isActiveNav(pathname: string, href: string): boolean {
  if (href === '/today') return pathname === '/today' || pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
