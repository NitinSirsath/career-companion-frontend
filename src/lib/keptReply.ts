import { useMemo, useSyncExternalStore } from 'react';
import { DraftDocSchema, type DraftDoc } from '../contracts/conversation';
import { isEmptyDoc } from './replyDoc';

/**
 * Unsent reply text, kept in this browser only (owner, 25 Oct 2026), one per conversation. It
 * comes back after a reload, and goes when the reply is sent, when the user discards it, and when
 * the user signs out. It never reaches the server. A browser that keeps nothing (private mode,
 * blocked storage) simply keeps nothing.
 */
const PREFIX = 'northlist.reply.';
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((listener) => listener());

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const raw = (threadId: string): string | null => {
  try {
    return storage()?.getItem(PREFIX + threadId) ?? null;
  } catch {
    return null;
  }
};

function parse(text: string | null): DraftDoc | null {
  if (!text) return null;
  try {
    const doc = DraftDocSchema.safeParse(JSON.parse(text));
    return doc.success && !isEmptyDoc(doc.data) ? doc.data : null;
  } catch {
    return null;
  }
}

/** The reply text kept for this conversation, or null. */
export const readKeptReply = (threadId: string): DraftDoc | null => parse(raw(threadId));

/** Keeps the reply text of this conversation; an empty reply removes it. */
export function keepReply(threadId: string, doc: DraftDoc | null) {
  try {
    if (doc && !isEmptyDoc(doc)) storage()?.setItem(PREFIX + threadId, JSON.stringify(doc));
    else storage()?.removeItem(PREFIX + threadId);
  } catch {
    // Full or blocked storage: the text stays in the box until the page closes.
  }
  changed();
}

/** Removes every kept reply: on sign-out, so the next person on this browser sees none. */
export function dropAllKeptReplies() {
  const store = storage();
  try {
    for (const key of Object.keys(store ?? {})) if (key.startsWith(PREFIX)) store?.removeItem(key);
  } catch {
    // Nothing to remove.
  }
  changed();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab of the app kept or sent a reply.
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/** The kept reply of this conversation, kept up to date. */
export function useKeptReply(threadId: string): DraftDoc | null {
  const text = useSyncExternalStore(
    subscribe,
    () => raw(threadId),
    () => null,
  );
  return useMemo(() => parse(text), [text]);
}
