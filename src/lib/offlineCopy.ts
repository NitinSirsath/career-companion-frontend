/**
 * The copies behind offline pages (owner, 30 Oct 2026): the data of the pages already seen, saved
 * in this browser for one user. A copy is dropped after 7 days, with a new version of the app,
 * and when that user signs out. It never holds a change to send later.
 */
import {
  dehydrate,
  hydrate,
  onlineManager,
  type DehydratedState,
  type Query,
  type QueryClient,
} from '@tanstack/react-query';
import type { User } from '../api/auth';

/** The data kept: the pages' own (by the first part of the query key) and what they show around. */
const KEPT_KEYS: readonly string[] = [
  'dashboard',
  'conversations',
  'mailbox',
  // The Mails tabs count the blocked senders; a test account's mails come from the sandbox.
  'blockedSenders',
  'sandbox',
  'applications',
  'application',
  'application-events',
  'application-actions',
  'application-submissions',
  'gmailStatus',
  'aiReading',
  'appMode',
  'aiSettings',
  'auth',
];

export const KEEP_FOR_MS = 7 * 24 * 60 * 60 * 1000;
/** Saves wait for the data to settle, so a page that loads many parts is saved once. */
const SAVE_AFTER_MS = 1000;

export interface SavedCopy {
  /** The app version that saved it: another version's copy may not fit, so it is dropped. */
  version: string;
  user: User;
  savedAt: number;
  state: DehydratedState;
}

/** Where the copy lives: IndexedDB in the browser, a stand-in in tests. */
export interface CopyStore {
  get(): Promise<unknown>;
  set(copy: SavedCopy): Promise<void>;
  clear(): Promise<void>;
}

const isKept = (query: Query) =>
  query.state.status === 'success' && KEPT_KEYS.includes(String(query.queryKey[0]));

const isSavedCopy = (value: unknown): value is SavedCopy => {
  const copy = value as Partial<SavedCopy> | null;
  return (
    typeof copy?.version === 'string' &&
    typeof copy.savedAt === 'number' &&
    typeof copy.user?.id === 'string' &&
    Array.isArray(copy.state?.queries)
  );
};

/** The saved copy, or null when there is none, it is too old, or another version saved it. */
export async function readCopy(
  store: CopyStore,
  version: string,
  now = Date.now(),
): Promise<SavedCopy | null> {
  const copy = await store.get().catch(() => null);
  if (isSavedCopy(copy) && copy.version === version && now - copy.savedAt <= KEEP_FOR_MS)
    return copy;
  if (copy) await store.clear().catch(() => undefined);
  return null;
}

/** Puts the copy's data into the app, leaving out anything older than 7 days. */
export function restoreCopy(client: QueryClient, copy: SavedCopy, now = Date.now()) {
  hydrate(client, {
    ...copy.state,
    queries: copy.state.queries.filter((query) => now - query.state.dataUpdatedAt <= KEEP_FOR_MS),
  });
}

/**
 * Saves the kept data whenever new data arrives, for this user, until stopped. Only while
 * online: offline nothing new comes in, and the copy keeps the time it was really saved.
 */
export function keepCopies(
  client: QueryClient,
  user: User,
  store: CopyStore,
  version: string,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    timer = undefined;
    if (!onlineManager.isOnline()) return;
    const state = dehydrate(client, { shouldDehydrateQuery: isKept });
    void store.set({ version, user, savedAt: Date.now(), state }).catch(() => undefined);
  };
  const stop = client.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success' || !isKept(event.query)) return;
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_AFTER_MS);
  });
  return () => {
    clearTimeout(timer);
    stop();
  };
}

// ─── IndexedDB ──────────────────────────────────────────────────────────────

const DB_NAME = 'northlist';
const STORE_NAME = 'offline';
const COPY_KEY = 'copy';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = act(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/** The browser's store. Without IndexedDB (some private windows) every call fails quietly. */
export const browserCopyStore: CopyStore = {
  get: () => run('readonly', (store) => store.get(COPY_KEY)),
  set: async (copy) => {
    await run('readwrite', (store) => store.put(copy, COPY_KEY));
  },
  clear: async () => {
    await run('readwrite', (store) => store.delete(COPY_KEY));
  },
};

/** Sign-out: the next person on this device sees nothing of this user's data. */
export const forgetOfflineCopies = () => browserCopyStore.clear().catch(() => undefined);
