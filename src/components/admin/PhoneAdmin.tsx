import { useState, type ReactNode } from 'react';
import { SendIcon } from 'lucide-react';
import { useFreeAIMoney, useResumeAccount } from '../../api/admin';
import { useSentMessages } from '../../api/messages';
import type { AdminAccount, AdminFreeAIMoney, AdminOverview } from '../../contracts/admin';
import {
  ACCOUNTS_PER_PAGE,
  count,
  needsALook,
  usd,
  whenLabel,
  type LookItem,
} from '../../lib/admin';
import {
  accountName,
  accountNote,
  lastActiveLabel,
  lastSentLabel,
  phoneNumbers,
} from '../../lib/adminPhone';
import { cn } from '../../lib/utils';
import { BarField, PhoneBottomBar } from '../phone/BottomBar';
import { PlainLinkRow, PlainRow, PlainSection } from '../phone/PlainList';
import { Pagination } from '../ui/pagination';
import { MessageSheet } from './MessageSheet';

/** Four numbers in one line (mock screen 13). */
function Numbers({ overview }: { overview: AdminOverview }) {
  return (
    <dl className="grid grid-cols-4 px-1 pt-1 pb-3.5">
      {phoneNumbers(overview).map((number) => (
        <div key={number.label} className="flex flex-col-reverse">
          <dt className="text-[11.5px] leading-4 font-medium text-text-secondary">
            {number.label}
          </dt>
          <dd className="text-[22px] leading-7 font-bold tabular-nums">{number.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Resume at once, as blue words at the right of the row. */
function ResumeAction({ account }: { account: AdminAccount }) {
  const resume = useResumeAccount();
  let label = 'Resume';
  if (resume.isPending) label = 'Resuming…';
  else if (resume.error) label = 'Try again';
  return (
    <button
      type="button"
      onClick={() => resume.mutate({ id: account.id })}
      disabled={resume.isPending}
      className="cursor-pointer text-[14.5px] font-semibold text-link disabled:opacity-50"
    >
      {label}
    </button>
  );
}

/** "daniel.o@example.com · Today, 2:05 PM": who asked, and when (mock screen 13). */
function resumeLine(account: AdminAccount) {
  const sent = account.suspension?.request?.sentAt;
  return sent ? `${account.email} · ${whenLabel(sent)}` : account.email;
}

function LookRow({ item }: { item: LookItem }) {
  return (
    <PlainRow
      detail={
        <>
          <span className={cn(item.tone === 'red' && 'text-late')}>
            {item.resume ? resumeLine(item.resume.account) : item.detail}
          </span>
          {item.resume && (
            <span className="mt-1 block text-text-primary">&ldquo;{item.resume.text}&rdquo;</span>
          )}
        </>
      }
      end={item.resume && <ResumeAction account={item.resume.account} />}
    >
      {item.title}
    </PlainRow>
  );
}

function NeedsALook({ items }: { items: LookItem[] }) {
  return (
    <PlainSection label={items.length ? `Needs a look · ${items.length}` : 'Needs a look'}>
      {items.length ? (
        items.map((item) => <LookRow key={item.key} item={item} />)
      ) : (
        <PlainRow>
          All good. No paused AI, failing syncs, unread mails, key problems or limits reached.
        </PlainRow>
      )}
    </PlainSection>
  );
}

function AccountRow({ account }: { account: AdminAccount }) {
  const note = accountNote(account);
  return (
    <PlainLinkRow
      to="/admin/accounts/$accountId"
      params={{ accountId: account.id }}
      detail={<span className={cn(note.red && 'text-late')}>{note.text}</span>}
      value={lastActiveLabel(account)}
    >
      <span className="break-all">{accountName(account)}</span>
    </PlainLinkRow>
  );
}

/** Every account, newest first, 25 at a time; each opens its own page. */
function Accounts({ accounts }: { accounts: readonly AdminAccount[] }) {
  const [offset, setOffset] = useState(0);
  const page = accounts.slice(offset, offset + ACCOUNTS_PER_PAGE);
  const last = Math.min(offset + ACCOUNTS_PER_PAGE, accounts.length);
  const test = accounts.filter((account) => account.testAccount).length;
  return (
    <PlainSection
      label={`Accounts · ${count(accounts.length)}`}
      note={test ? `${test} test ${test === 1 ? 'account' : 'accounts'} not counted` : undefined}
    >
      {page.map((account) => (
        <AccountRow key={account.id} account={account} />
      ))}
      {accounts.length > ACCOUNTS_PER_PAGE && (
        <Pagination
          offset={offset}
          limit={ACCOUNTS_PER_PAGE}
          hasNext={last < accounts.length}
          onPrevious={() => setOffset(Math.max(0, offset - ACCOUNTS_PER_PAGE))}
          onNext={() => setOffset(offset + ACCOUNTS_PER_PAGE)}
          summary={`${offset + 1}–${last} of ${count(accounts.length)}`}
        />
      )}
    </PlainSection>
  );
}

/** "$3.10 left", or what is known when there is no limit or no answer. */
function moneyValue(money: AdminFreeAIMoney | undefined, loading: boolean): ReactNode {
  if (loading) return 'Checking…';
  if (!money || money.state === 'UNAVAILABLE') return 'Not checked';
  if (money.state === 'NO_KEY') return 'No key';
  if (money.leftUsd !== null) return `${usd(money.leftUsd)} left`;
  return `${usd(money.monthUsd)} this month`;
}

/** "Message to everyone" in the bottom glass bar, where a mail page has Reply. */
function MessageBar({ onOpen }: { onOpen: () => void }) {
  return (
    <PhoneBottomBar label="Admin actions">
      <BarField icon={<SendIcon aria-hidden="true" />} onClick={onOpen}>
        Message to everyone
      </BarField>
    </PhoneBottomBar>
  );
}

/**
 * The Admin page on phones (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` screen 13): four numbers
 * in one line, then Needs a look, Accounts, Free AI money and Messages as plain rows. "Message to
 * everyone" sits in the bottom glass bar and opens the message sheet.
 */
export function PhoneAdmin({ overview }: { overview: AdminOverview }) {
  const money = useFreeAIMoney();
  const sent = useSentMessages();
  const [writing, setWriting] = useState(false);
  const items = needsALook(overview, money.data);
  return (
    <>
      <Numbers overview={overview} />
      <NeedsALook items={items} />
      <Accounts accounts={overview.accounts} />
      <PlainSection>
        <PlainLinkRow to="/admin/money" value={moneyValue(money.data, money.isLoading)}>
          Free AI money
        </PlainLinkRow>
        <PlainRow
          onClick={() => setWriting(true)}
          value={lastSentLabel(sent.data?.messages[0]?.sentAt)}
          chevron
        >
          Messages
        </PlainRow>
      </PlainSection>
      <MessageBar onOpen={() => setWriting(true)} />
      <MessageSheet open={writing} onOpenChange={setWriting} accounts={overview.accounts} />
    </>
  );
}
