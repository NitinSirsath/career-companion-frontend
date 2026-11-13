import { createContext, useContext } from 'react';
import type { PhoneTab } from '../../lib/phoneStack';
import type { SwipeTarget } from './useSwipeBack';

/** What a phone page can ask of the frame around it. */
export interface PhoneNav {
  tab: PhoneTab;
  /** How many pages are open in this tab; more than one shows Back. */
  depth: number;
  /** True on a tab's first page: the tab bar shows. */
  isRoot: boolean;
  /** Back one page, with the slide. */
  back: () => void;
  /** Another tab; the open tab again goes back to its first page, then to the top. */
  openTab: (tab: PhoneTab) => void;
  /** Where a detail page puts its action bar, at the bottom. */
  barTarget: HTMLElement | null;
  /** The words of the page's big title, so the top bar can show them once it has scrolled away. */
  setBigTitle: (words: string | null) => void;
}

/** The frame's own parts, on top of what pages use. */
export interface PhoneFrame extends PhoneNav {
  setBarTarget: (element: HTMLElement | null) => void;
  /** The small title's words. */
  titleWords: string | null;
  /** Where pages put their top bar buttons (the breadcrumb slot's actions place). */
  actionsPlace?: (element: HTMLElement | null) => void;
  swipe: SwipeTarget;
}

export const PhoneNavContext = createContext<PhoneNav | null>(null);

/** The phone frame around this page; null on laptops and in tests that render a page alone. */
export const usePhoneNav = () => useContext(PhoneNavContext);
