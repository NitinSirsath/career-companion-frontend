import { useState } from 'react';
import { Menu } from '@base-ui/react/menu';
import { Navigate, useParams } from '@tanstack/react-router';
import { EllipsisIcon } from 'lucide-react';
import { useAdminOverview, useResumeAccount, useSuspendAccount } from '../../api/admin';
import { isApiError } from '../../api/client';
import { SUSPEND_REASON_MAX_LENGTH, type AdminAccount } from '../../contracts/admin';
import { whenLabel } from '../../lib/admin';
import { accountCrumb, accountFacts, accountName } from '../../lib/adminPhone';
import { cn } from '../../lib/utils';
import { TopBarActions } from '../layout/Breadcrumb';
import { usePhoneNav } from '../phone/phoneNav';
import { CapsuleButton, GlassCapsule } from '../phone/GlassButton';
import { PlainRow, PlainSection } from '../phone/PlainList';
import { PhoneTitle } from '../phone/PhoneTitle';
import { InlineNotification } from '../ui/notification';
import { SectionError } from '../ui/section-error';
import { POPUP_CLASS, ITEM_CLASS } from '../ui/select';
import { Sheet } from '../ui/sheet';
import { SkeletonList } from '../ui/skeleton';

const problem = (err: unknown) =>
  isApiError(err) && err.kind === 'http' && err.status !== undefined && err.status < 500
    ? err.message
    : 'This did not go through. Try again.';

/**
 * Suspend, on phones (mock `PHONE-LINEAR-mock/` screen 15): a floating sheet; the reason is
 * required, because the user sees it on their suspended page.
 */
function SuspendSheet({
  account,
  open,
  onOpenChange,
}: {
  account: AdminAccount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState('');
  const suspend = useSuspendAccount();
  const ready = reason.trim().length > 0;
  const name = accountName(account);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`Suspend ${name}`} initialFocus={false}>
      <p className="px-0.5 text-[14px] leading-[1.4] text-text-secondary">
        They can still sign in but only see a &ldquo;suspended&rdquo; page with your reason. Gmail
        sync, NorthList Apply and alerts stop for them. Their data and their beta place are kept, so
        Resume brings everything back.
      </p>
      <textarea
        aria-label="Why are they suspended? (required, they will see it)"
        rows={3}
        maxLength={SUSPEND_REASON_MAX_LENGTH}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Why (they will see this) — required"
        className="min-h-[76px] resize-none rounded-2xl bg-surface-subtle px-3.5 py-3 text-[15px] leading-[1.42] text-text-primary outline-none placeholder:text-text-tertiary focus-visible:ring-2 focus-visible:ring-border-focus"
      />
      {suspend.error && (
        <InlineNotification kind="error">{problem(suspend.error)}</InlineNotification>
      )}
      <button
        type="button"
        disabled={!ready || suspend.isPending}
        onClick={() =>
          suspend.mutate(
            { id: account.id, reason: reason.trim() },
            { onSuccess: () => onOpenChange(false) },
          )
        }
        className="mt-1 h-12 cursor-pointer rounded-full bg-late text-base font-semibold text-white transition-[opacity,scale] duration-200 active:scale-[1.02] disabled:cursor-default disabled:opacity-40"
      >
        {suspend.isPending ? 'Suspending…' : 'Suspend'}
      </button>
    </Sheet>
  );
}

/** The ··· in the top bar: Suspend… or Resume; nothing for your own account. */
function MoreMenu({ account, onSuspend }: { account: AdminAccount; onSuspend: () => void }) {
  const resume = useResumeAccount();
  if (account.self) return null;
  return (
    <TopBarActions>
      <GlassCapsule label="Account tools">
        <Menu.Root>
          <Menu.Trigger render={<CapsuleButton label={`More for ${account.email}`} />}>
            <EllipsisIcon size={22} aria-hidden="true" />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner align="end" sideOffset={8} className="z-50 outline-none">
              <Menu.Popup className={cn(POPUP_CLASS, 'phone-type min-w-52')}>
                {account.suspension ? (
                  <Menu.Item
                    className={ITEM_CLASS}
                    disabled={resume.isPending}
                    onClick={() => resume.mutate({ id: account.id })}
                  >
                    Resume
                  </Menu.Item>
                ) : (
                  <Menu.Item className={cn(ITEM_CLASS, 'text-late')} onClick={onSuspend}>
                    Suspend…
                  </Menu.Item>
                )}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </GlassCapsule>
    </TopBarActions>
  );
}

/** Why the account is suspended, and what the user asked, with Resume. */
function Suspension({ account }: { account: AdminAccount }) {
  const resume = useResumeAccount();
  const suspension = account.suspension;
  if (!suspension) return null;
  return (
    <PlainSection label="Suspended">
      <PlainRow detail={suspension.reason}>Why</PlainRow>
      {suspension.request && (
        <PlainRow detail={<>&ldquo;{suspension.request.text}&rdquo;</>}>
          Asked to resume · {whenLabel(suspension.request.sentAt)}
        </PlainRow>
      )}
      <PlainRow
        onClick={() => resume.mutate({ id: account.id })}
        tone="blue"
        detail={resume.error ? problem(resume.error) : undefined}
      >
        {resume.isPending ? 'Resuming…' : 'Resume'}
      </PlainRow>
    </PlainSection>
  );
}

/**
 * One account, on phones (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` screen 15): laid out like
 * a mail, with a grey line, the big name and the facts as pills. ··· › Suspend opens a sheet.
 * Account facts and counts only, never their mail.
 */
export function PhoneAccountPage({ accountId }: { accountId: string }) {
  const overview = useAdminOverview();
  const [suspending, setSuspending] = useState(false);
  if (overview.isLoading) return <SkeletonList rows={3} label="Loading the account" />;
  const account = overview.data?.accounts.find((each) => each.id === accountId);
  if (!account)
    return (
      <SectionError
        title={overview.error ? 'Could not load the account' : 'This account is not there any more'}
        onRetry={overview.error ? () => void overview.refetch() : undefined}
      />
    );
  const name = accountName(account);
  return (
    <div className="flex flex-col">
      <MoreMenu account={account} onSuspend={() => setSuspending(true)} />
      <p className="px-0.5 text-[13.5px] leading-[18px] text-text-secondary">
        {accountCrumb(account)}
      </p>
      <PhoneTitle size="detail" className="px-0.5 pt-[3px] pb-2">
        {name}
      </PhoneTitle>
      {name !== account.email && (
        <p className="px-0.5 pb-3 text-[14px] break-all text-text-secondary">{account.email}</p>
      )}
      <ul
        aria-label="Facts"
        className="-mx-1 flex flex-wrap gap-[7px] rounded-[22px] bg-surface-subtle p-2"
      >
        {accountFacts(account).map((fact) => (
          <li
            key={fact.key}
            className={cn(
              'inline-flex h-[31px] items-center rounded-full bg-[var(--glass-pill)] px-3 text-[14px] font-medium whitespace-nowrap',
              fact.tone === 'red' && 'text-late',
            )}
          >
            {fact.text}
          </li>
        ))}
      </ul>
      <Suspension account={account} />
      <SuspendSheet account={account} open={suspending} onOpenChange={setSuspending} />
    </div>
  );
}

/** The route's page: on laptops every account is in the Admin page's table instead. */
export function PhoneAccountRoute() {
  const { accountId } = useParams({ from: '/admin_/accounts/$accountId' });
  const phone = !!usePhoneNav();
  return phone ? <PhoneAccountPage accountId={accountId} /> : <Navigate to="/admin" replace />;
}
