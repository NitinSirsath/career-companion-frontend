import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useResumeAccount, useSuspendAccount } from '../../api/admin';
import { isApiError } from '../../api/client';
import { SUSPEND_REASON_MAX_LENGTH, type AdminAccount } from '../../contracts/admin';
import { clock } from '../../lib/aiLabels';
import {
  ACCOUNTS_PER_PAGE,
  aiLabel,
  count,
  dayLabel,
  KEY_PROBLEM,
  whenLabel,
} from '../../lib/admin';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { DataTable } from '../ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { InlineNotification } from '../ui/notification';
import { Pagination } from '../ui/pagination';
import { Tag } from '../ui/tag';
import { Textarea } from '../ui/textarea';

const problem = (err: unknown) =>
  isApiError(err) && err.kind === 'http' && err.status !== undefined && err.status < 500
    ? err.message
    : 'This did not go through. Try again.';

/** The reason is required: the user sees it on their suspended page (owner, 18 Nov 2026). */
function SuspendDialog({ account, onClose }: { account: AdminAccount; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const suspend = useSuspendAccount();
  const ready = reason.trim().length > 0;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspend {account.email}?</DialogTitle>
          <DialogDescription>
            They can still sign in, but see only a &ldquo;suspended&rdquo; page with a form to ask
            you to resume.
          </DialogDescription>
        </DialogHeader>
        <ul className="-mt-3 mb-5 list-disc space-y-1 pl-5 text-sm text-text-secondary">
          <li>Gmail sync, NorthList Apply and alerts stop for them.</li>
          <li>Their data and their beta place are kept. Resume brings everything back.</li>
        </ul>
        <label className="text-[13px] font-medium" htmlFor="suspend-reason">
          Why are they suspended? (required, they will see it)
        </label>
        <Textarea
          id="suspend-reason"
          className="mt-1.5 rounded-xl"
          rows={3}
          maxLength={SUSPEND_REASON_MAX_LENGTH}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        {suspend.error && (
          <InlineNotification kind="error" className="mt-3">
            {problem(suspend.error)}
          </InlineNotification>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!ready}
            loading={suspend.isPending}
            onClick={() =>
              suspend.mutate({ id: account.id, reason: reason.trim() }, { onSuccess: onClose })
            }
          >
            {suspend.isPending ? 'Suspending…' : 'Suspend'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function resumeLabel(pending: boolean, failed: boolean) {
  if (pending) return 'Resuming…';
  return failed ? 'Try again' : 'Resume';
}

/** Resume at once: it only gives back what the account had. A plain button, or a blue word. */
export function ResumeButton({ account, link }: { account: AdminAccount; link?: boolean }) {
  const resume = useResumeAccount();
  return (
    <Button
      size="sm"
      // In a Needs a look row it reads as a blue word (laptop v2, 18 Nov 2026).
      variant={link ? 'ghost' : 'secondary'}
      loading={resume.isPending}
      title={resume.error ? problem(resume.error) : undefined}
      onClick={() => resume.mutate({ id: account.id })}
    >
      {resumeLabel(resume.isPending, !!resume.error)}
    </Button>
  );
}

/**
 * Laptops (laptop v2, owner 18 Nov 2026): the name over the email, then Test or Suspended as a
 * plain word, red for Suspended. No coloured labels.
 */
function AccountName({ account }: { account: AdminAccount }) {
  const flags = [account.testAccount && 'Test', account.suspension && 'Suspended'].filter(Boolean);
  return (
    <div className="flex min-w-0 flex-col">
      <span className="truncate font-medium">{account.name ?? account.email}</span>
      {account.name && (
        <span className="truncate text-xs text-text-secondary">{account.email}</span>
      )}
      {flags.length > 0 && (
        <span
          className={cn('text-xs', account.suspension ? 'text-danger-text' : 'text-text-tertiary')}
        >
          {flags.join(' · ')}
        </span>
      )}
    </div>
  );
}

/** Gmail in words: grey while fine, red when sync fails or access was removed. */
function GmailCell({ account }: { account: AdminAccount }) {
  const { state, lastSyncedAt } = account.gmail;
  if (state === 'SYNC_FAILING') return <span className="text-danger-text">Sync failing</span>;
  if (state === 'ACCESS_REMOVED') return <span className="text-danger-text">Access removed</span>;
  if (state === 'NOT_CONNECTED') return <span className="text-text-tertiary">Not connected</span>;
  return (
    <span className="text-text-secondary">
      {lastSyncedAt ? `Synced ${clock(lastSyncedAt)}` : 'Connected'}
    </span>
  );
}

/** The AI in words; a key problem or a reached daily limit in red. */
function AICell({ account }: { account: AdminAccount }) {
  const label = aiLabel(account);
  if (!label) return <span className="text-text-tertiary">Not set up</span>;
  return (
    <div className="flex min-w-0 flex-col text-text-secondary">
      <span className="truncate">{label}</span>
      {account.ai.keyProblem && (
        <span className="text-xs text-danger-text">{KEY_PROBLEM[account.ai.keyProblem]}</span>
      )}
      {account.limitsReached.ai && <span className="text-xs text-danger-text">Daily limit</span>}
    </div>
  );
}

function ActionCell({
  account,
  onSuspend,
}: {
  account: AdminAccount;
  onSuspend: (account: AdminAccount) => void;
}) {
  if (account.suspension) return <ResumeButton account={account} />;
  if (account.self) return null;
  return (
    <Button size="sm" variant="secondary" onClick={() => onSuspend(account)}>
      Suspend
    </Button>
  );
}

const lastActive = (account: AdminAccount) =>
  account.lastActiveAt ? whenLabel(account.lastActiveAt) : '—';

function columns(onSuspend: (account: AdminAccount) => void): ColumnDef<AdminAccount>[] {
  return [
    {
      id: 'account',
      header: 'Account',
      cell: ({ row }) => <AccountName account={row.original} />,
    },
    {
      id: 'signedUp',
      header: 'Signed up',
      meta: { className: 'text-text-secondary' },
      cell: ({ row }) => dayLabel(row.original.createdAt),
    },
    {
      id: 'active',
      header: 'Last active',
      meta: { className: 'text-text-secondary' },
      cell: ({ row }) => lastActive(row.original),
    },
    { id: 'gmail', header: 'Gmail', cell: ({ row }) => <GmailCell account={row.original} /> },
    { id: 'ai', header: 'AI', cell: ({ row }) => <AICell account={row.original} /> },
    {
      id: 'mails',
      header: () => <span title="Mails checked in the last 30 days">Mails</span>,
      meta: { className: 'md:text-right tabular-nums text-text-secondary' },
      cell: ({ row }) => count(row.original.mailsChecked30d),
    },
    {
      id: 'applications',
      header: () => <span title="Applications">Apps</span>,
      meta: { className: 'md:text-right tabular-nums text-text-secondary' },
      cell: ({ row }) => count(row.original.applications),
    },
    {
      id: 'action',
      header: '',
      meta: { className: 'md:text-right', interactive: true },
      cell: ({ row }) => <ActionCell account={row.original} onSuspend={onSuspend} />,
    },
  ];
}

/** " · suspended Nov 16", " · active today", " · active Nov 13"; nothing before the first visit. */
function activeText(account: AdminAccount) {
  if (account.suspension) return ` · suspended ${dayLabel(account.suspension.suspendedAt)}`;
  if (!account.lastActiveAt) return '';
  const when = whenLabel(account.lastActiveAt);
  if (when.startsWith('Today')) return ' · active today';
  return ` · active ${when === 'Yesterday' ? 'yesterday' : when}`;
}

/** One account on phones: the facts in two lines, tags, and Suspend or Resume. */
function PhoneAccount({
  account,
  onSuspend,
}: {
  account: AdminAccount;
  onSuspend: (account: AdminAccount) => void;
}) {
  const gmail =
    account.gmail.state === 'CONNECTED' && account.gmail.lastSyncedAt
      ? `Gmail synced ${clock(account.gmail.lastSyncedAt)} · `
      : '';
  const ai = aiLabel(account);
  return (
    <div className="flex flex-col gap-1 py-3">
      <span className="text-[17px] leading-[22px] break-all">{account.email}</span>
      <span className="text-[15px] leading-5 text-text-secondary">
        Signed up {dayLabel(account.createdAt)}
        {activeText(account)}
      </span>
      <span className="text-[15px] leading-5 text-text-secondary">
        {gmail}
        {ai ? `${ai} · ` : ''}
        {count(account.mailsChecked30d)} mails · {count(account.applications)}{' '}
        {account.applications === 1 ? 'application' : 'applications'}
      </span>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {account.testAccount && <Tag>Test</Tag>}
        {account.suspension && <Tag color="red">Suspended</Tag>}
        {account.gmail.state === 'SYNC_FAILING' && <Tag color="red">Sync failing</Tag>}
        {account.gmail.state === 'ACCESS_REMOVED' && <Tag color="red">Access removed</Tag>}
        {account.ai.keyProblem && <Tag color="red">{KEY_PROBLEM[account.ai.keyProblem]}</Tag>}
        {account.limitsReached.ai && <Tag color="yellow">Daily limit reached</Tag>}
        <span className="ml-auto">
          <ActionCell account={account} onSuspend={onSuspend} />
        </span>
      </div>
    </div>
  );
}

/** Every account, newest first, 25 at a time. */
export function AdminAccounts({ accounts }: { accounts: readonly AdminAccount[] }) {
  const [offset, setOffset] = useState(0);
  const [suspending, setSuspending] = useState<AdminAccount | null>(null);
  const page = accounts.slice(offset, offset + ACCOUNTS_PER_PAGE);
  const last = Math.min(offset + ACCOUNTS_PER_PAGE, accounts.length);
  return (
    <>
      <DataTable
        label="Accounts"
        data={page}
        columns={columns(setSuspending)}
        getRowId={(account) => account.id}
        gridTemplate="minmax(0,1.7fr) 60px minmax(0,0.9fr) minmax(0,1fr) minmax(0,0.9fr) 48px 40px 88px"
        phoneRow={(account) => <PhoneAccount account={account} onSuspend={setSuspending} />}
        footer={
          accounts.length > ACCOUNTS_PER_PAGE && (
            <Pagination
              offset={offset}
              limit={ACCOUNTS_PER_PAGE}
              hasNext={last < accounts.length}
              onPrevious={() => setOffset(Math.max(0, offset - ACCOUNTS_PER_PAGE))}
              onNext={() => setOffset(offset + ACCOUNTS_PER_PAGE)}
              summary={`${offset + 1}–${last} of ${count(accounts.length)}`}
            />
          )
        }
      />
      {suspending && <SuspendDialog account={suspending} onClose={() => setSuspending(null)} />}
    </>
  );
}
