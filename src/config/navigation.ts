import {
  CalendarDays,
  Dumbbell,
  Flame,
  Home,
  LayoutGrid,
  Lightbulb,
  ListChecks,
  Scale,
  Settings,
  Sparkles,
  TrendingUp,
  UserRound,
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
   * The bottom bar carries six destinations, the last of which is More. Every
   * other screen lives behind it rather than being squeezed into a seventh
   * target too narrow to hit on a phone.
   */
  inBottomNav: boolean;
  /**
   * The geometric mark the bottom bar draws instead of an icon. A CSS
   * `border-radius` value: a circle for Today, a soft square for Habits, a
   * teardrop for Nourish, and so on. The set is meant to be learned as a
   * shape language, which is why the labels never hide.
   */
  markRadius: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: '/today', label: 'Today', icon: Home, inBottomNav: true, markRadius: '50%' },
  {
    href: '/habits',
    label: 'Habits',
    icon: ListChecks,
    inBottomNav: true,
    markRadius: '6px',
  },
  {
    href: '/nutrition',
    label: 'Nutrition',
    icon: UtensilsCrossed,
    shortLabel: 'Nourish',
    inBottomNav: true,
    markRadius: '50% 50% 50% 6px',
  },
  {
    href: '/workout',
    label: 'Movement',
    icon: Dumbbell,
    shortLabel: 'Move',
    inBottomNav: true,
    markRadius: '3px',
  },
  {
    href: '/skincare',
    label: 'Skincare',
    icon: Sparkles,
    shortLabel: 'Glow',
    inBottomNav: true,
    markRadius: '50%',
  },
  {
    href: '/more',
    label: 'More',
    icon: LayoutGrid,
    inBottomNav: true,
    markRadius: '9px 3px 9px 3px',
  },
];

/** Everything that lives behind More on a phone, and in the sidebar on desktop. */
export const MORE_ITEMS: NavItem[] = [
  { href: '/weight', label: 'Weight', icon: Scale, inBottomNav: false, markRadius: '50%' },
  { href: '/progress', label: 'Progress', icon: TrendingUp, inBottomNav: false, markRadius: '50%' },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays, inBottomNav: false, markRadius: '6px' },
  { href: '/insights', label: 'Insights', icon: Lightbulb, inBottomNav: false, markRadius: '50%' },
  { href: '/streak', label: 'Streak', icon: Flame, inBottomNav: false, markRadius: '50%' },
  { href: '/profile', label: 'Profile', icon: UserRound, inBottomNav: false, markRadius: '50%' },
  { href: '/settings', label: 'Settings', icon: Settings, inBottomNav: false, markRadius: '50%' },
];

export const BOTTOM_NAV_ITEMS = NAV_ITEMS.filter((item) => item.inBottomNav);

/** The desktop sidebar shows every destination, in one flat list. */
export const SIDEBAR_ITEMS: NavItem[] = [
  ...NAV_ITEMS.filter((item) => item.href !== '/more'),
  ...MORE_ITEMS,
];

/** Longest-prefix match, so `/progress/timeline` still highlights Progress. */
export function isActiveNav(pathname: string, href: string): boolean {
  if (href === '/today') return pathname === '/today' || pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * More stays lit while you are on any screen it leads to. Without this the bar
 * shows nothing selected on half the app, which reads as "you are lost".
 */
export function isMoreActive(pathname: string): boolean {
  if (isActiveNav(pathname, '/more')) return true;
  return MORE_ITEMS.some((item) => isActiveNav(pathname, item.href));
}
