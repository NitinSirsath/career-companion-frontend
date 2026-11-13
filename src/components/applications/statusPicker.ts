import { createContext } from 'react';

/** The phone's status sheet: open or closed, as the page's action bar also opens it. */
export interface StatusPicker {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Set on phones by the application's header (owner, 12 Nov 2026): the status then picks from a
 * sheet, which the action bar's Status button opens too.
 */
export const StatusPickerContext = createContext<StatusPicker | null>(null);
