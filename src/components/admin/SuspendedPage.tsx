import { useState } from 'react';
import { format, isToday } from 'date-fns';
import { CircleCheckIcon, CirclePauseIcon, TriangleAlertIcon } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { logout, sendResumeRequest, type User } from '../../api/auth';
import { RESUME_REQUEST_MAX_LENGTH } from '../../contracts/auth';
import { dropAllKeptReplies } from '../../lib/keptReply';
import { forgetOfflineCopies } from '../../lib/offlineCopy';
import { Wordmark } from '../layout/Logo';
import { useIsPhone } from '../layout/useIsPhone';
import { Button } from '../ui/button';
import { InlineNotification } from '../ui/notification';
import { Textarea } from '../ui/textarea';

type Suspension = NonNullable<User['suspension']>;

/** Signs out without the alerts step: every other request of a suspended account is refused. */
async function signOut() {
  dropAllKeptReplies();
  await forgetOfflineCopies().catch(() => undefined);
  await logout().catch(() => undefined);
  window.location.href = '/login';
}

const sentAt = (iso: string) => {
  const date = new Date(iso);
  return isToday(date) ? `today, ${format(date, 'h:mm a')}` : format(date, 'MMM d, h:mm a');
};

function RequestForm({
  initial,
  onSent,
  onCancel,
}: {
  initial: string;
  onSent: (suspension: Suspension) => void;
  onCancel?: () => void;
}) {
  const [text, setText] = useState(initial);
  const send = useMutation({ mutationFn: sendResumeRequest });
  const ready = text.trim().length > 0;
  return (
    <form
      className="flex flex-col gap-3 rounded-2xl bg-surface-subtle p-5 max-md:p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        send.mutate(text.trim(), {
          onSuccess: (profile) => profile.suspension && onSent(profile.suspension),
        });
      }}
    >
      <h2 className="text-base font-semibold max-md:text-[17px]">Ask to resume</h2>
      <label htmlFor="resume-request" className="text-[13px] font-medium max-md:text-[15px]">
        Tell us anything we should know
      </label>
      <Textarea
        id="resume-request"
        rows={4}
        maxLength={RESUME_REQUEST_MAX_LENGTH}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="rounded-xl max-md:text-[17px]"
      />
      {send.error && (
        <InlineNotification kind="error">
          Your request was not sent. Check your connection and try again.
        </InlineNotification>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-text-secondary max-md:text-[13px]">
          Up to {RESUME_REQUEST_MAX_LENGTH.toLocaleString('en-US')} characters
        </span>
        <span className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={!ready} loading={send.isPending}>
            {send.isPending ? 'Sending…' : 'Send'}
          </Button>
        </span>
      </div>
    </form>
  );
}

/** The phone's request: one field, a count, and Ask to resume (mock screen 16). */
function PhoneRequestForm({
  initial,
  onSent,
  onCancel,
}: {
  initial: string;
  onSent: (suspension: Suspension) => void;
  onCancel?: () => void;
}) {
  const [text, setText] = useState(initial);
  const send = useMutation({ mutationFn: sendResumeRequest });
  const ready = text.trim().length > 0;
  return (
    <form
      className="flex flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        send.mutate(text.trim(), {
          onSuccess: (profile) => profile.suspension && onSent(profile.suspension),
        });
      }}
    >
      <textarea
        aria-label="Tell us anything we should know"
        rows={3}
        maxLength={RESUME_REQUEST_MAX_LENGTH}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Ask to resume: tell us what changed…"
        className="min-h-[88px] resize-none rounded-2xl bg-surface-subtle px-3.5 py-3 text-[15px] leading-[1.42] text-text-primary outline-none placeholder:text-text-tertiary focus-visible:ring-2 focus-visible:ring-border-focus"
      />
      <p className="pt-1.5 pr-0.5 text-right text-[12.5px] text-text-tertiary tabular-nums">
        {text.length} / {RESUME_REQUEST_MAX_LENGTH.toLocaleString('en-US')}
      </p>
      {send.error && (
        <InlineNotification kind="error" className="mt-2">
          Your request was not sent. Check your connection and try again.
        </InlineNotification>
      )}
      <button
        type="submit"
        disabled={!ready || send.isPending}
        className="mt-2.5 h-12 cursor-pointer rounded-full bg-accent text-base font-semibold text-on-accent transition-[opacity,scale] duration-200 active:scale-[1.02] disabled:cursor-default disabled:opacity-40"
      >
        {send.isPending ? 'Sending…' : 'Ask to resume'}
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="mt-1 h-11 cursor-pointer text-[15px] text-text-secondary"
        >
          Cancel
        </button>
      )}
    </form>
  );
}

/**
 * What a suspended user sees on phones (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` screen 16):
 * one calm page with the icon, the title, the reason, Ask to resume and Sign out. No tab bar.
 */
function PhoneSuspendedPage({ suspension: first }: { suspension: Suspension }) {
  const [suspension, setSuspension] = useState(first);
  const [changing, setChanging] = useState(false);
  const request = suspension.request;
  return (
    <div className="phone-type min-h-dvh bg-background px-[18px] pt-[calc(env(safe-area-inset-top)+28px)] pb-[calc(env(safe-area-inset-bottom)+24px)] text-text-primary">
      <main className="mx-auto flex max-w-[520px] flex-col">
        <div className="px-2.5 text-center">
          <span
            aria-hidden="true"
            className="mx-auto mt-[30px] mb-4 flex size-16 items-center justify-center rounded-full bg-surface-subtle text-text-secondary"
          >
            <CirclePauseIcon size={28} />
          </span>
          <h1 className="mb-2 text-[22px] leading-7 font-bold tracking-[-0.015em]">
            Your account is suspended
          </h1>
          <p className="text-[14.5px] leading-[1.45] text-text-secondary">
            You can&rsquo;t use NorthList right now. Your mails, applications and settings are kept.
          </p>
          <p className="mt-1.5 text-[14.5px] leading-[1.45] text-text-secondary">
            Your Gmail is not read while your account is suspended. When it is resumed, the app
            reads the mail you missed, up to 30 days back.
          </p>
          <div
            role="alert"
            className="mt-4 mb-[18px] rounded-2xl bg-surface-subtle px-3.5 py-3 text-left text-[14.5px] leading-[1.4]"
          >
            <span className="mb-0.5 block text-[12.5px] text-text-secondary">Why</span>
            {suspension.reason}
          </div>
        </div>
        {request && !changing ? (
          <div
            role="status"
            className="rounded-2xl bg-surface-subtle px-3.5 py-3 text-[14.5px] leading-[1.4]"
          >
            <p className="flex items-start gap-2">
              <CircleCheckIcon size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-ok" />
              <span>
                <b className="font-semibold">Request sent {sentAt(request.sentAt)}.</b>{' '}
                <span className="text-text-secondary">
                  You will be able to use the app as soon as it is resumed. Any reply comes by
                  email.
                </span>
              </span>
            </p>
            <button
              type="button"
              onClick={() => setChanging(true)}
              className="mt-2 ml-[25px] cursor-pointer text-[14.5px] font-medium text-link"
            >
              Change my request
            </button>
          </div>
        ) : (
          <PhoneRequestForm
            initial={request?.text ?? ''}
            onCancel={request ? () => setChanging(false) : undefined}
            onSent={(next) => {
              setSuspension(next);
              setChanging(false);
            }}
          />
        )}
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-1.5 h-11 cursor-pointer text-center text-[15px] font-medium text-danger-text"
        >
          Sign out
        </button>
      </main>
    </div>
  );
}

/**
 * What a suspended account sees after sign-in, instead of the app (owner, 18 Nov 2026, approved
 * mock `ADMIN-PANEL-mock/`): why, what is kept, a form to ask to resume, and Sign out. Phones get
 * their own calm page (mock `PHONE-LINEAR-mock/` screen 16).
 */
export function SuspendedPage({ suspension: first }: { suspension: Suspension }) {
  if (useIsPhone()) return <PhoneSuspendedPage suspension={first} />;
  return <LaptopSuspendedPage suspension={first} />;
}

function LaptopSuspendedPage({ suspension: first }: { suspension: Suspension }) {
  const [suspension, setSuspension] = useState(first);
  const [changing, setChanging] = useState(false);
  const request = suspension.request;
  return (
    <div className="min-h-dvh bg-canvas text-text-primary max-md:phone-type">
      <header className="flex h-14 items-center justify-between border-b border-border-subtle px-6 max-md:px-4 max-md:pt-[env(safe-area-inset-top)]">
        <Wordmark size={20} />
        <Button variant="ghost" className="max-md:hidden" onClick={() => void signOut()}>
          Sign out
        </Button>
      </header>
      <main className="mx-auto flex w-full max-w-[520px] flex-col gap-4 px-4 pt-[72px] pb-12 max-md:pt-8">
        <h1 className="text-[28px] leading-9 font-semibold tracking-[-0.02em] max-md:text-[30px] max-md:font-bold">
          Your account is suspended
        </h1>
        <div
          role="alert"
          className="flex gap-2.5 rounded-xl bg-tag-red-bg px-3.5 py-3 text-sm leading-5 text-tag-red ring-1 ring-tag-red-ring ring-inset max-md:rounded-2xl max-md:text-[15px]"
        >
          <TriangleAlertIcon size={18} aria-hidden="true" className="mt-px shrink-0" />
          <span>
            <b className="font-semibold">You can&rsquo;t use NorthList right now.</b>
            <br />
            Why: {suspension.reason}
          </span>
        </div>
        <div className="flex flex-col gap-1.5 text-sm leading-5 text-text-secondary max-md:text-[15px]">
          <p>Your applications, mails and settings are kept.</p>
          <p>
            Your Gmail is not read while your account is suspended. When it is resumed, the app
            reads the mail you missed, up to 30 days back.
          </p>
        </div>
        {request && !changing ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-surface-subtle p-5 max-md:p-4">
            <p
              role="status"
              className="flex items-start gap-2.5 text-sm leading-5 max-md:text-[15px]"
            >
              <CircleCheckIcon size={18} aria-hidden="true" className="mt-px shrink-0 text-ok" />
              <span>
                <b className="font-semibold">Request sent {sentAt(request.sentAt)}.</b>
                <br />
                <span className="text-text-secondary">
                  You will be able to use the app as soon as it is resumed. Any reply comes by
                  email.
                </span>
              </span>
            </p>
            <button
              type="button"
              onClick={() => setChanging(true)}
              className="self-start text-sm text-link hover:underline max-md:text-[15px]"
            >
              Change my request
            </button>
          </div>
        ) : (
          <RequestForm
            initial={request?.text ?? ''}
            onCancel={request ? () => setChanging(false) : undefined}
            onSent={(next) => {
              setSuspension(next);
              setChanging(false);
            }}
          />
        )}
        <button
          type="button"
          onClick={() => void signOut()}
          className="h-[50px] rounded-2xl bg-surface-subtle text-[17px] text-danger-text md:hidden"
        >
          Sign out
        </button>
      </main>
    </div>
  );
}
