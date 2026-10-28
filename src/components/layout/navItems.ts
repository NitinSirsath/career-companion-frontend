import {
  Chemistry,
  Dashboard,
  Document,
  Email,
  Flow,
  MachineLearningModel,
  Renew,
  User,
  type CarbonIconType,
} from '@carbon/icons-react';
import { listSearch } from '../../lib/listMemory';

export interface NavItem {
  to:
    | '/mails'
    | '/applications'
    | '/dashboard'
    | '/gmail'
    | '/ai'
    | '/automation'
    | '/sandbox'
    | '/account';
  /** Also the page's title: a menu name and its page always say the same thing. */
  label: string;
  icon: CarbonIconType;
}

/**
 * A menu link: dark text with a grey icon; the chosen page has a light blue tint with blue text.
 * Used by the side menu and the phone menu.
 */
export const NAV_LINK_CLASS =
  'flex h-9 shrink-0 items-center gap-3 overflow-hidden px-3 text-sm whitespace-nowrap text-text-primary transition-colors duration-70 ease-standard hover:bg-layer-hover [&_svg]:text-text-secondary [&.active]:bg-tint [&.active]:text-tint-text [&.active_svg]:text-link';

/** The pages used every day, in menu order. */
export const MAIN_NAV: readonly NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: Dashboard },
  { to: '/mails', label: 'Mails', icon: Email },
  { to: '/applications', label: 'Applications', icon: Document },
];

/** Set up once, visited rarely. */
export const SETTINGS_NAV: readonly NavItem[] = [
  { to: '/gmail', label: 'Gmail sync', icon: Renew },
  { to: '/ai', label: 'AI providers', icon: MachineLearningModel },
  { to: '/automation', label: 'Automation', icon: Flow },
];

/** A list page returns to its last filters and page when opened from the menu. */
export function rememberedSearch(to: NavItem['to']): Record<string, unknown> | undefined {
  return to === '/mails' || to === '/applications' ? listSearch(to) : undefined;
}

/** Dev mode only. */
export const SANDBOX_NAV: NavItem = { to: '/sandbox', label: 'Mail sandbox', icon: Chemistry };

/** Opened from the account menu, not the side menu. */
const ACCOUNT_PAGE: NavItem = { to: '/account', label: 'Account', icon: User };

const SECTIONS: readonly NavItem[] = [...MAIN_NAV, ...SETTINGS_NAV, SANDBOX_NAV, ACCOUNT_PAGE];

/** The section a path belongs to, by its first part: "/mails/abc" is Mails. */
export function sectionOf(path: string): NavItem | undefined {
  const first = `/${path.split('/')[1] ?? ''}`;
  return SECTIONS.find((item) => item.to === first);
}
