import { createContext, useContext } from 'react';

export interface BreadcrumbSlot {
  /** Where in the top bar the page's breadcrumb goes. */
  target: HTMLElement | null;
  setTarget: (element: HTMLElement | null) => void;
  /** True while a page shows a breadcrumb of its own. */
  claimed: boolean;
  /** Called by a page's breadcrumb; returns the call that gives the place back. */
  claim: () => () => void;
}

export const BreadcrumbSlotContext = createContext<BreadcrumbSlot | null>(null);

/** The top bar's place for the breadcrumb; null outside the signed-in app. */
export const useBreadcrumbSlot = () => useContext(BreadcrumbSlotContext);
