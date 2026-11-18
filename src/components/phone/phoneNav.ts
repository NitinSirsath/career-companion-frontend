import { createContext, useContext, useEffect } from 'react';
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
  /** Where a detail page puts its bottom bar. */
  barTarget: HTMLElement | null;
  /**
   * Where a tab's first page puts its big title: the first row of the page, beside the top
   * buttons, above the offline line and owner messages.
   */
  titleTarget: HTMLElement | null;
  /** The words of the page's big title, so the top bar can show them once it has scrolled away. */
  setBigTitle: (words: string | null) => void;
  /**
   * What the tab bar's Search circle does on this page (a list opens its own search). With none,
   * Search opens the Mails tab and asks it to open its search.
   */
  setSearch: (open: (() => void) | null) => void;
  /** More to do when the page is pulled down to refresh, such as asking Gmail for new mail. */
  setPullAlso: (also: (() => unknown) | null) => void;
}

/** The frame's own parts, on top of what pages use. */
export interface PhoneFrame extends PhoneNav {
  setBarTarget: (element: HTMLElement | null) => void;
  setTitleTarget: (element: HTMLElement | null) => void;
  /** The small title's words. */
  titleWords: string | null;
  /** Where pages put their top bar buttons (the breadcrumb slot's actions place). */
  actionsPlace?: (element: HTMLElement | null) => void;
  swipe: SwipeTarget;
  /** What the page asked to do on pull to refresh, besides fetching again. */
  pullAlso: (() => unknown) | null;
}

/** What the bar at the bottom shows: the tab bar, a detail page's bottom bar, or nothing. */
export type BarMode = 'tabs' | 'detail' | 'none';

export const PhoneNavContext = createContext<PhoneNav | null>(null);

/** The phone frame around this page; null on laptops and in tests that render a page alone. */
export const usePhoneNav = () => useContext(PhoneNavContext);

/**
 * The tab bar's Search on this page: `open` shows the page's own search. While no page has one,
 * Search goes to Mails, whose search then opens as soon as it registers.
 */
export function useTabBarSearch(open: () => void) {
  const setSearch = useContext(PhoneNavContext)?.setSearch;
  useEffect(() => {
    if (!setSearch) return;
    setSearch(open);
    return () => setSearch(null);
  }, [setSearch, open]);
}

/** More to do on pull to refresh than fetching the page again (Gmail: check for new mail). */
export function usePullRefreshAlso(also: () => unknown) {
  const setPullAlso = useContext(PhoneNavContext)?.setPullAlso;
  useEffect(() => {
    if (!setPullAlso) return;
    setPullAlso(also);
    return () => setPullAlso(null);
  }, [setPullAlso, also]);
}
