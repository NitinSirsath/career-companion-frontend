import {
  Chemistry,
  Dashboard,
  Document,
  Email,
  Flow,
  MachineLearningModel,
  Renew,
  type CarbonIconType,
} from '@carbon/icons-react';

export interface NavItem {
  to: '/mails' | '/applications' | '/dashboard' | '/gmail' | '/ai' | '/automation' | '/sandbox';
  /** Also the page's title: a menu name and its page always say the same thing. */
  label: string;
  icon: CarbonIconType;
}

/** The pages used every day, in menu order. */
export const MAIN_NAV: readonly NavItem[] = [
  { to: '/mails', label: 'Mails', icon: Email },
  { to: '/applications', label: 'Applications', icon: Document },
  { to: '/dashboard', label: 'Dashboard', icon: Dashboard },
];

/** Set up once, visited rarely. */
export const SETTINGS_NAV: readonly NavItem[] = [
  { to: '/gmail', label: 'Gmail sync', icon: Renew },
  { to: '/ai', label: 'AI provider', icon: MachineLearningModel },
  { to: '/automation', label: 'Automation', icon: Flow },
];

/** Dev mode only. */
export const SANDBOX_NAV: NavItem = { to: '/sandbox', label: 'Mail sandbox', icon: Chemistry };
