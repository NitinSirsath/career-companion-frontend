import { useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '../../api/auth';
import {
  browserCopyStore,
  keepCopies,
  readCopy,
  restoreCopy,
  type CopyStore,
  type SavedCopy,
} from '../../lib/offlineCopy';
import { StartupScreen } from './StartupScreen';
import { useSignInCheck, type SignInCheck } from './useSignInCheck';

/** A store that does not answer in time counts as no copy: the app never waits on it. */
const READ_COPY_WITHIN_MS = 1000;

/** The saved copy for offline pages: undefined while it is read, null when there is none. */
function useSavedCopy(store: CopyStore, version: string) {
  const [copy, setCopy] = useState<SavedCopy | null | undefined>(undefined);
  useEffect(() => {
    let current = true;
    const late = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), READ_COPY_WITHIN_MS),
    );
    void Promise.race([readCopy(store, version), late]).then((found) => {
      if (current) setCopy(found);
    });
    return () => {
      current = false;
    };
  }, [store, version]);
  return copy;
}

/** Who the app opens for: the user the server named, or offline the copy's user. */
function openFor(check: SignInCheck, copy: SavedCopy | null | undefined): User | null | undefined {
  if (copy === undefined) return undefined;
  if (check.known) return check.user;
  return check.stage === 'offline' && copy ? copy.user : undefined;
}

/**
 * Shows the start-up screen until the app knows who is signed in, then the app for that user.
 * Offline, with a copy saved on this device, the app opens at once for the copy's user, read-only
 * (owner, 30 Oct 2026), and checks again when back online. A copy is used only for its own user;
 * with someone else or nobody signed in, it is dropped.
 */
export function SignInGate({
  children,
  store = browserCopyStore,
  version = __APP_VERSION__,
}: {
  children: (user: User | null) => ReactNode;
  store?: CopyStore;
  version?: string;
}) {
  const check = useSignInCheck();
  const copy = useSavedCopy(store, version);
  const queryClient = useQueryClient();
  const user = openFor(check, copy);

  // The copy's data goes in before the app draws, so its pages open with their data. Doing it
  // again changes nothing: data the app fetched since is newer and is kept.
  if (copy && user && copy.user.id === user.id) restoreCopy(queryClient, copy);
  useEffect(() => {
    if (user !== undefined && copy && copy.user.id !== user?.id)
      void store.clear().catch(() => undefined);
  }, [user, copy, store]);

  // New data is saved for this user while the app is open.
  useEffect(
    () => (user ? keepCopies(queryClient, user, store, version) : undefined),
    [user, queryClient, store, version],
  );

  if (user !== undefined) return children(user);
  if (check.known) return <StartupScreen stage="checking" waitedMs={0} onRetry={() => undefined} />;
  return <StartupScreen stage={check.stage} waitedMs={check.waitedMs} onRetry={check.retry} />;
}
