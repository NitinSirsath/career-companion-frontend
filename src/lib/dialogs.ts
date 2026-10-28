import type { RefObject } from 'react';
import type { QueryClient } from '@tanstack/react-query';

// Every list that shows to-dos or applications, read again after a follow-through change.
const FOLLOW_THROUGH_KEYS = [
  'workspace',
  'actions',
  'application-actions',
  'application',
  'applications',
  'agenda',
];

export const refreshFollowThrough = (client: QueryClient) =>
  Promise.all(FOLLOW_THROUGH_KEYS.map((key) => client.invalidateQueries({ queryKey: [key] })));

/** Opens a dialog from outside, such as from a "…" menu. */
export interface DialogHandle {
  open: () => void;
}

/** Where a dialog opened from a menu gives focus back when it closes. */
export const focusLater = (target: RefObject<HTMLElement | null> | undefined) =>
  queueMicrotask(() => target?.current?.focus());

export interface TriggerOptions {
  /** False when the dialog opens from elsewhere, through its handle. */
  trigger?: boolean;
  /** Gets focus back when there is no trigger button. */
  returnFocus?: RefObject<HTMLElement | null>;
}
