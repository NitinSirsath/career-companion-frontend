import { createContext } from 'react';

/**
 * On a phone the reply covers the screen, as in phone mail apps: Send sits in its top bar, and the
 * one-line note and the glass tool bar (✦ AI, then the format buttons) at its bottom, just above
 * the keyboard (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` #4). The reply screen gives these
 * places.
 */
export const PhoneReplySlots = createContext<{
  send: HTMLElement | null;
  note: HTMLElement | null;
  ai: HTMLElement | null;
  format: HTMLElement | null;
} | null>(null);
