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

/** Resume at once: it only gives back what the account had. */
export function ResumeButton({ account, primary }: { account: AdminAccount; primary?: boolean }) {
  const resume = useResumeAccount();
  return (
    <Button
      size="sm"
      variant={primary ? 'primary' : 'secondary'}
      loading={resume.isPending}
      title={resume.error ? problem(resume.error) : undefined}
      onClick={() => resume.mutate({ id: account.id })}
    >
      {resumeLabel(resume.isPending, !!resume.error)}
    </Button>
  );
}

function AccountName({ account }: { account: AdminAccount }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="flex flex-wrap items-center gap-1.5 break-all">
        {account.email}
        {account.testAccount && <Tag>Test</Tag>}
        {account.suspension && <Tag color="red">Suspended</Tag>}
      </span>
      {account.name && <span className="text-xs text-text-secondary">{account.name}</span>}
    </div>
  );
}

function GmailCell({ account }: { account: AdminAccount }) {
  const { state, lastSyncedAt } = account.gmail;
  if (state === 'SYNC_FAILING') return <Tag color="red">Sync failing</Tag>;
  if (state === 'ACCESS_REMOVED') return <Tag color="red">Access removed</Tag>;
  if (state === 'NOT_CONNECTED') return <span className="text-text-tertiary">Not connected</span>;
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className="size-[7px] shrink-0 rounded-full bg-ok" />
      {lastSyncedAt ? `Synced ${clock(lastSyncedAt)}` : 'Connected'}
    </span>
  );
}

function AICell({ account }: { account: AdminAccount }) {
  const label = aiLabel(account);
  if (!label) return <span className="text-text-tertiary">Not set up</span>;
  return (
    <div className="flex flex-col items-start gap-1">
      <span>{label}</span>
      {account.ai.keyProblem && <Tag color="red">{KEY_PROBLEM[account.ai.keyProblem]}</Tag>}
      {account.limitsReached.ai && <Tag color="yellow">Daily limit reached</Tag>}
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
    { id: 'signedUp', header: 'Signed up', cell: ({ row }) => dayLabel(row.original.createdAt) },
    { id: 'active', header: 'Last active', cell: ({ row }) => lastActive(row.original) },
    { id: 'gmail', header: 'Gmail', cell: ({ row }) => <GmailCell account={row.original} /> },
    { id: 'ai', header: 'AI', cell: ({ row }) => <AICell account={row.original} /> },
    {
      id: 'mails',
      header: 'Mails · 30 days',
      meta: { className: 'md:text-right tabular-nums' },
      cell: ({ row }) => count(row.original.mailsChecked30d),
    },
    {
      id: 'applications',
      header: 'Applications',
      meta: { className: 'md:text-right tabular-nums' },
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
        gridTemplate="minmax(0,2fr) minmax(0,0.7fr) minmax(0,0.9fr) minmax(0,1.25fr) minmax(0,1.1fr) minmax(0,0.75fr) minmax(0,0.85fr) 88px"
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
