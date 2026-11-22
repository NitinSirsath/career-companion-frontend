import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api, isApiError } from '../../api/client';
import type { PortalAccount } from '../../contracts/submission';
import { format, isValid } from 'date-fns';
import { safeHttpUrl } from '../../lib/safeUrl';
import { Button } from '../ui/button';

/** How long a shown password stays on screen. */
export const SHOW_FOR_MS = 30_000;
const DOTS = '••••••••••';

const muted = (text: string) => <span className="text-text-tertiary">{text}</span>;

function madeLine(account: PortalAccount) {
  const who = account.madeBy === 'USER' ? 'By you' : account.madeBy ? 'By NorthList Apply' : null;
  const day = account.createdOn ? new Date(`${account.createdOn}T00:00:00`) : null;
  const when = day && isValid(day) ? format(day, 'd MMM yyyy') : null;
  if (!who && !when) return muted('Not sent');
  return [who, when].filter(Boolean).join(', ');
}

function emailCheckedLine(value: boolean | null) {
  if (value === true) return 'Yes';
  if (value === false) return muted('Not yet');
  return muted('Not sent');
}

/**
 * The company-portal account the automation used (owner, 21 Nov 2026). The password is fetched
 * only on Show or Copy, kept in this component's state, and hidden again after 30 seconds.
 */
function PasswordValue({ account }: { account: PortalAccount }) {
  const [password, setPassword] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState<'show' | 'copy' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function load() {
    if (password !== null) return password;
    const { password: value } = await api.revealPortalPassword(account.id);
    setPassword(value);
    return value;
  }

  const failed = (err: unknown) =>
    setNote(
      isApiError(err) && err.status === 503
        ? 'NorthList cannot open this password right now.'
        : 'Could not get the password. Try again.',
    );

  async function toggle() {
    setNote(null);
    if (shown) {
      clearTimeout(timer.current);
      setShown(false);
      return;
    }
    setBusy('show');
    try {
      await load();
      setShown(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setShown(false), SHOW_FOR_MS);
    } catch (err) {
      failed(err);
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    setNote(null);
    setBusy('copy');
    try {
      await navigator.clipboard.writeText(await load());
      setNote('Copied.');
    } catch (err) {
      if (isApiError(err)) failed(err);
      else setNote('Copying failed. Use Show and copy it yourself.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <code
          className={shown ? 'font-mono break-all' : 'font-mono tracking-[0.18em]'}
          aria-label={shown ? undefined : 'Password hidden'}
        >
          {shown && password !== null ? password : DOTS}
        </code>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={busy === 'show'}
          disabled={busy === 'copy'}
          onClick={() => void toggle()}
        >
          {shown ? 'Hide' : 'Show'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={busy === 'copy'}
          disabled={busy === 'show'}
          onClick={() => void copy()}
        >
          Copy
        </Button>
      </div>
      {shown && <p className="text-xs text-text-tertiary">Hides again in 30 seconds.</p>}
      {note && (
        <p role="status" className="text-xs text-text-secondary">
          {note}
        </p>
      )}
    </div>
  );
}

export function PortalAccountCard({
  account,
  card: Card,
}: {
  account: PortalAccount;
  card: (props: { title: string; children: ReactNode }) => ReactNode;
}) {
  const href = safeHttpUrl(account.signInUrl);
  const facts: { label: string; value: ReactNode }[] = [
    {
      label: 'Sign-in page',
      value: href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-link">
          {account.signInUrl}
        </a>
      ) : (
        <span className="break-all">{account.signInUrl}</span>
      ),
    },
    { label: 'Email', value: account.loginEmail },
    {
      label: 'Password',
      value: account.hasPassword ? (
        <PasswordValue account={account} />
      ) : account.madeBy === 'USER' ? (
        muted('You set it yourself. NorthList Apply did not see it.')
      ) : (
        muted('Not sent')
      ),
    },
    { label: 'Email checked', value: emailCheckedLine(account.emailVerified) },
    { label: 'Made', value: madeLine(account) },
  ];
  const others = account.otherApplications;
  return (
    <Card title="Portal account">
      <dl className="grid grid-cols-[112px_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        {facts.map(({ label, value }) => (
          <div key={label} className="contents">
            <dt className="text-text-secondary">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-border-subtle pt-3 text-xs text-text-secondary">
        {others > 0
          ? `Also used for ${others} other application${others === 1 ? '' : 's'} at ${account.company}.`
          : 'Used only for this application.'}
      </p>
    </Card>
  );
}
