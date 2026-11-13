import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronRightIcon, CircleCheckIcon, MailIcon, RotateCcwIcon } from 'lucide-react';
import { useSetRequestState } from '../../api/conversations';
import type { ConversationDetail, ConversationRequest } from '../../contracts/conversation';
import { reopenNote, showMail, stepNote, stepSource } from '../../lib/jobStep';
import { dueIn, keyDates } from '../../lib/mailThread';
import {
  FAKE_OFFER,
  closesByHand,
  fakeOfferStep,
  requestDetail,
  requestPastDue,
  requestTitle,
  scheduleLine,
} from '../../lib/mails';
import { isOfflineError } from '../../lib/offline';
import { cn } from '../../lib/utils';
import { StatusBadge } from '../ApplicationStatus';
import { InlineNotification } from '../ui/notification';
import { Sheet, SheetAction, SheetGroup } from '../ui/sheet';
import { Tag } from '../ui/tag';
import { showToast } from '../ui/toast';
import { ConversationApplication } from './ConversationApplication';
import { ReadingReply, StepDue, StepState } from './StepParts';
import { TodoState } from './TodoState';

/*
 * A job mail's job side on a phone (owner, 13 Nov 2026, approved mock `IOS-LOOK-mock/`): the next
 * step as one row above the conversation, with all of it in a sheet; the way to make the
 * application while there is none; key dates and the application behind ⓘ.
 */

const CARD = 'flex w-full items-center gap-3 rounded-2xl bg-surface-subtle px-4 py-3 text-left';

/** The step's second line in its row: when it is due (red once past), else where it stands. */
function StepRowState({ asked, fake }: { asked: ConversationRequest; fake: boolean }) {
  if (asked.state === 'OPEN' && asked.deadline && !fake) {
    const pastDue = requestPastDue(asked);
    return (
      <span className={cn('text-[15px]', pastDue ? 'text-danger-text' : 'text-text-secondary')}>
        {requestDetail(asked)} · {dueIn(asked.deadline, new Date())}
      </span>
    );
  }
  return (
    <span className="flex">
      <TodoState state={asked.state} fakeOffer={fake} />
    </span>
  );
}

/** The step's actions: "I did this" or Reopen, and the way to the mail that asks or closed it. */
function StepActions({ detail, onClose }: { detail: ConversationDetail; onClose: () => void }) {
  const { conversation } = detail;
  const change = useSetRequestState(conversation.key);
  const asked = conversation.request!;
  const title = requestTitle(asked);
  const fake = fakeOfferStep(conversation);
  const source = stepSource(detail);
  const setState = (state: 'DONE' | 'OPEN', toast: string) =>
    change.mutate(
      { emailId: asked.emailId, state },
      {
        onSuccess: () => {
          onClose();
          showToast(toast);
        },
      },
    );
  const canDo = asked.state === 'OPEN' && closesByHand(asked) && !fake;
  return (
    <>
      {change.isError && !isOfflineError(change.error) && (
        <InlineNotification kind="error">
          Could not update: {change.error.message}
        </InlineNotification>
      )}
      <SheetGroup>
        {canDo && (
          <SheetAction
            icon={<CircleCheckIcon size={22} aria-hidden="true" />}
            disabled={change.isPending}
            onClick={() => setState('DONE', `Done: ${title}`)}
          >
            I did this
          </SheetAction>
        )}
        {asked.state !== 'OPEN' && (
          <SheetAction
            icon={<RotateCcwIcon size={22} aria-hidden="true" />}
            disabled={change.isPending}
            onClick={() => setState('OPEN', `Reopened: ${title}`)}
          >
            Reopen
          </SheetAction>
        )}
        {source && (
          <SheetAction
            icon={<MailIcon size={22} aria-hidden="true" />}
            onClick={() => {
              onClose();
              // After the sheet has gone, so the page can scroll.
              window.setTimeout(() => showMail(source.messageId), 300);
            }}
          >
            {source.label}
          </SheetAction>
        )}
      </SheetGroup>
    </>
  );
}

/** Everything about the step: what it asks, when, where it stands and why it closed. */
function StepSheet({
  detail,
  open,
  onOpenChange,
}: {
  detail: ConversationDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const asked = detail.conversation.request!;
  const fake = fakeOfferStep(detail.conversation);
  const note = fake
    ? FAKE_OFFER.stepNote
    : (stepNote(asked, requestPastDue(asked), true) ?? reopenNote(asked));
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Next step">
      <p className="text-[19px] leading-[25px] break-words">{requestTitle(asked)}</p>
      {!fake && <StepDue asked={asked} />}
      <StepState asked={asked} fake={fake} />
      <ReadingReply detail={detail} />
      <StepActions detail={detail} onClose={() => onOpenChange(false)} />
      {note && <p className="text-[13px] leading-[18px] text-text-tertiary">{note}</p>}
    </Sheet>
  );
}

/** The next step as one row; a tap opens its sheet. With nothing asked, the row only says so. */
function PhoneNextStep({ detail }: { detail: ConversationDetail }) {
  const { conversation } = detail;
  const [open, setOpen] = useState(false);
  const asked = conversation.request;
  if (!asked)
    return (
      <section aria-label="Next step" className={CARD}>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[13px] text-text-tertiary">Next step</span>
          <span className="text-[17px] leading-[22px]">
            {scheduleLine(conversation) ?? 'Nothing needed from you'}
          </span>
        </span>
      </section>
    );
  const title = requestTitle(asked);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Next step: ${title}`}
        className={cn(
          CARD,
          'min-h-[66px] cursor-pointer transition-colors duration-450 active:bg-surface-selected active:duration-0',
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[13px] text-text-tertiary">Next step</span>
          <span
            className={cn(
              'line-clamp-2 text-[17px] leading-[22px] break-words',
              asked.state === 'DONE' && 'text-text-tertiary line-through',
            )}
          >
            {title}
          </span>
          <StepRowState asked={asked} fake={fakeOfferStep(conversation)} />
        </span>
        <ChevronRightIcon size={18} aria-hidden="true" className="shrink-0 text-text-tertiary" />
      </button>
      <StepSheet detail={detail} open={open} onOpenChange={setOpen} />
    </>
  );
}

/** The phone's way to make the application, right under the next step (owner, 7 Nov 2026). */
function PhoneCreateApplication({
  conversation,
}: {
  conversation: ConversationDetail['conversation'];
}) {
  return (
    <section
      aria-label="Application"
      className="mt-3 flex flex-col gap-2.5 rounded-2xl bg-surface-subtle px-4 pt-3.5 pb-4 text-[15px]"
    >
      <p>This conversation has no application yet.</p>
      <ConversationApplication conversation={conversation} />
      <p className="text-[13px] text-text-tertiary">
        One tap. The details come from this mail. Later mails from the same company join it by
        themselves.
      </p>
    </section>
  );
}

/**
 * Above the conversation on a phone: the next step as one row, and the way to make the
 * application while there is none (a probable fake offer keeps it behind ⓘ).
 */
export function PhoneJobMailTop({ detail }: { detail: ConversationDetail }) {
  const { conversation } = detail;
  const oneTap =
    !conversation.application &&
    conversation.link !== 'IGNORED' &&
    conversation.fakeOfferWarning === null;
  return (
    <div role="group" aria-label="About this job mail" className="pb-1.5">
      <PhoneNextStep detail={detail} />
      {oneTap && <PhoneCreateApplication conversation={conversation} />}
    </div>
  );
}

/** The mail's application as one row that opens it. */
function ApplicationRow({
  application,
  onOpen,
}: {
  application: NonNullable<ConversationDetail['conversation']['application']>;
  onOpen: () => void;
}) {
  return (
    <Link
      to="/applications/$id"
      params={{ id: application.id }}
      onClick={onOpen}
      className="flex min-h-[56px] items-center gap-3 px-[18px] py-2.5 active:bg-surface-selected"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[17px]">{application.companyName}</span>
        {application.jobTitle && (
          <span className="truncate text-[15px] text-text-secondary">{application.jobTitle}</span>
        )}
      </span>
      <StatusBadge status={application.effectiveStatus} />
      {application.archived && <Tag color="outline">Archived</Tag>}
      <ChevronRightIcon size={18} aria-hidden="true" className="shrink-0 text-text-tertiary" />
    </Link>
  );
}

/** The dates the mails name, as they wrote them. */
function KeyDates({ detail }: { detail: ConversationDetail }) {
  const dates = keyDates(detail.mails);
  if (!dates.length) return <p className="text-text-secondary">The mails name no dates.</p>;
  return (
    <>
      <dl className="grid grid-cols-[130px_minmax(0,1fr)] gap-x-3 gap-y-2 text-base">
        {dates.map((date) => (
          <div key={date.label} className="contents">
            <dt className="text-text-secondary">{date.label}</dt>
            <dd className="break-words">{date.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[13px] text-text-tertiary">As the mails wrote them.</p>
    </>
  );
}

/** "About this job mail" on a phone, behind ⓘ: the key dates, and the application. */
export function PhoneJobMailInfo({
  detail,
  open,
  onOpenChange,
}: {
  detail: ConversationDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { conversation } = detail;
  const application = conversation.application;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="About this job mail">
      <h3 className="text-[17px] font-semibold">Key dates</h3>
      <KeyDates detail={detail} />
      <h3 className="pt-2 text-[17px] font-semibold">Application</h3>
      {application ? (
        <SheetGroup>
          <ApplicationRow application={application} onOpen={() => onOpenChange(false)} />
        </SheetGroup>
      ) : (
        <ConversationApplication conversation={conversation} />
      )}
    </Sheet>
  );
}
