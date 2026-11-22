import { useState } from 'react';
import { format } from 'date-fns';
import { useAdminInvites } from '../../api/invites';
import type { AdminInvite } from '../../contracts/invites';
import { inviteSourceLabel } from '../../lib/invites';
import { PlainRow, PlainSection } from '../phone/PlainList';
import { showToast } from '../ui/toast';

/** Rows shown before "Show all". */
export const INVITES_SHOWN = 10;

const day = (invite: AdminInvite) => format(new Date(invite.createdAt), 'MMM d');

/** Every email, one per line, for the release mail. */
async function copyEmails(invites: readonly AdminInvite[]) {
  try {
    await navigator.clipboard.writeText(invites.map((invite) => invite.email).join('\n'));
    showToast(invites.length === 1 ? 'Copied 1 email' : `Copied ${invites.length} emails`);
  } catch {
    showToast('Could not copy. Try again.');
  }
}

function useShown() {
  const invites = useAdminInvites();
  const [all, setAll] = useState(false);
  const list = invites.data ?? [];
  return {
    invites,
    list,
    shown: all ? list : list.slice(0, INVITES_SHOWN),
    more: !all && list.length > INVITES_SHOWN,
    showAll: () => setAll(true),
  };
}

/** The list under the title: loading, a problem, nothing yet, or the rows. */
function LaptopRows({ state }: { state: ReturnType<typeof useShown> }) {
  const { invites, list, shown, more, showAll } = state;
  const line = 'border-b border-border-subtle px-2.5 py-2.5 text-sm text-text-secondary';
  if (invites.isLoading) return <p className={line}>Loading…</p>;
  if (invites.isError)
    return (
      <p className={line}>
        Could not load the invites.{' '}
        <button
          type="button"
          onClick={() => void invites.refetch()}
          className="cursor-pointer text-link underline"
        >
          Try again
        </button>
      </p>
    );
  if (!list.length)
    return (
      <p className={line}>
        No requests yet. They show here when the beta is full and someone asks for an invite.
      </p>
    );
  return (
    <ul>
      {shown.map((invite) => (
        <li
          key={invite.email}
          className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] items-baseline gap-4 border-b border-border-subtle px-2.5 py-2.5 text-sm"
        >
          <span className="truncate">{invite.email}</span>
          <span className="truncate text-text-secondary">
            {inviteSourceLabel(invite.source, invite.otherSource)}
          </span>
          <span className="text-text-tertiary tabular-nums">{day(invite)}</span>
        </li>
      ))}
      {more && (
        <li className="px-2.5 py-2.5 text-sm">
          <button
            type="button"
            onClick={showAll}
            className="cursor-pointer text-link hover:underline"
          >
            Show all {list.length}
          </button>
        </li>
      )}
    </ul>
  );
}

/**
 * Release invites on the laptop Admin page (owner, 22 Nov 2026): who asked for an invite while the
 * beta was full, newest first, with Copy emails for the release mail.
 */
export function AdminInvites() {
  const state = useShown();
  const { list } = state;
  return (
    <section aria-labelledby="admin-invites-title">
      <div className="mt-5 mb-1.5 flex items-baseline justify-between gap-3">
        <h2
          id="admin-invites-title"
          className="flex items-baseline gap-2 text-xs font-semibold text-text-secondary"
        >
          Release invites
          {list.length > 0 && <span className="font-medium">· {list.length}</span>}
        </h2>
        {list.length > 0 && (
          <button
            type="button"
            onClick={() => void copyEmails(list)}
            className="cursor-pointer text-xs text-link hover:underline"
          >
            Copy emails
          </button>
        )}
      </div>
      <LaptopRows state={state} />
    </section>
  );
}

/** Release invites on the phone Admin tab: the same list as plain rows. */
export function PhoneInvites() {
  const { invites, list, shown, more, showAll } = useShown();
  if (invites.isLoading || invites.isError) return null;
  return (
    <PlainSection
      label={list.length ? `Release invites · ${list.length}` : 'Release invites'}
      note={list.length ? undefined : 'No requests yet.'}
    >
      {shown.map((invite) => (
        <PlainRow
          key={invite.email}
          detail={inviteSourceLabel(invite.source, invite.otherSource)}
          value={day(invite)}
        >
          <span className="break-all">{invite.email}</span>
        </PlainRow>
      ))}
      {more && (
        <PlainRow onClick={showAll} center>
          Show all {list.length}
        </PlainRow>
      )}
      {list.length > 0 && (
        <PlainRow onClick={() => void copyEmails(list)} center>
          Copy emails
        </PlainRow>
      )}
    </PlainSection>
  );
}
