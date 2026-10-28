import { createContext } from 'react';

/**
 * On a phone the reply covers the screen, as in phone mail apps: Send sits in its top bar, and the
 * format row at its bottom, just above the keyboard. The reply screen gives these two places.
 */
export const PhoneReplySlots = createContext<{
  send: HTMLElement | null;
  format: HTMLElement | null;
} | null>(null);
