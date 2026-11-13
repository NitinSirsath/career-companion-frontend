import {
  FileTextIcon,
  FlaskConicalIcon,
  LayoutGridIcon,
  MailIcon,
  RefreshCwIcon,
  UserIcon,
  WorkflowIcon,
  type LucideIcon,
} from 'lucide-react';
import { AiIcon } from '../ui/ai-icon';
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
  icon: LucideIcon;
}

/**
 * A menu link: dark text with a grey icon; the chosen page has a light blue tint with blue text.
 * Used by the side menu and the phone menu.
 */
export const NAV_LINK_CLASS =
  'flex h-[34px] shrink-0 items-center gap-2.5 overflow-hidden rounded-full px-3 text-[14px] leading-5 whitespace-nowrap text-text-secondary transition-colors duration-70 ease-standard hover:bg-[var(--canvas-hover)] hover:text-text-primary [&_svg]:text-text-tertiary [&.active]:bg-[var(--nav-active)] [&.active]:shadow-[var(--nav-active-shadow)] [&.active]:font-medium [&.active]:text-text-primary [&.active_svg]:text-text-primary';

/** The pages used every day, in menu order. */
export const MAIN_NAV: readonly NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutGridIcon },
  { to: '/mails', label: 'Mails', icon: MailIcon },
  { to: '/applications', label: 'Applications', icon: FileTextIcon },
];

/** Set up once, visited rarely. */
export const SETTINGS_NAV: readonly NavItem[] = [
  { to: '/gmail', label: 'Gmail sync', icon: RefreshCwIcon },
  { to: '/ai', label: 'AI providers', icon: AiIcon },
  { to: '/automation', label: 'NorthList Apply', icon: WorkflowIcon },
];

/** A list page returns to its last filters and page when opened from the menu. */
export function rememberedSearch(to: NavItem['to']): Record<string, unknown> | undefined {
  return to === '/mails' || to === '/applications' ? listSearch(to) : undefined;
}

/** Dev mode only. */
export const SANDBOX_NAV: NavItem = {
  to: '/sandbox',
  label: 'Mail sandbox',
  icon: FlaskConicalIcon,
};

/** Opened from the account menu, not the side menu. */
const ACCOUNT_PAGE: NavItem = { to: '/account', label: 'Account', icon: UserIcon };

const SECTIONS: readonly NavItem[] = [...MAIN_NAV, ...SETTINGS_NAV, SANDBOX_NAV, ACCOUNT_PAGE];

/** The section a path belongs to, by its first part: "/mails/abc" is Mails. */
export function sectionOf(path: string): NavItem | undefined {
  const first = `/${path.split('/')[1] ?? ''}`;
  return SECTIONS.find((item) => item.to === first);
}
