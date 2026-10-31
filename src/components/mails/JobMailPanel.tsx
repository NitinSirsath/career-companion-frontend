import { useState, type ReactNode } from 'react';
import { ArrowDown, Calendar, ChevronDown } from '@carbon/icons-react';
import { useSetRequestState } from '../../api/conversations';
import type {
  ConversationDetail,
  ConversationMail,
  ConversationRequest,
} from '../../contracts/conversation';
import { modelName } from '../../lib/aiLabels';
import { askingMessageId, dueIn, keyDates } from '../../lib/mailThread';
import {
  FAKE_OFFER,
  fakeOfferStep,
  CLOSED_REASON_LABEL,
  closesByHand,
  mailDateTime,
  parseSender,
  repliedLine,
  requestDetail,
  requestPastDue,
  requestTitle,
  scheduleLine,
} from '../../lib/mails';
import { cn } from '../../lib/utils';
import { useIsPhone } from '../layout/useIsPhone';
import { Button } from '../ui/button';
import { Collapse } from '../ui/collapse';
import { OverflowMenu } from '../ui/menu';
import { InlineNotification } from '../ui/notification';
import { showToast } from '../ui/toast';
import { ConversationApplication } from './ConversationApplication';
import { TodoState } from './TodoState';
import { isOfflineError } from '../../lib/offline';

/** On phones a card that folds: its title is a button, the rest opens under it. */
function FoldedSection({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-label={title} className="border border-border-subtle bg-surface">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-h-13 w-full cursor-pointer items-center justify-between gap-3 px-4 text-left text-sm font-semibold"
        >
          {title}
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={cn('transition-transform duration-150 ease-standard', open && 'rotate-180')}
          />
        </button>
      </h2>
      <Collapse open={open}>
        <div className="flex flex-col gap-3 px-4 pb-4">{children}</div>
      </Collapse>
    </section>
  );
}

function PanelSection({
  title,
  fold = false,
  menu,
  children,
}: {
  title: string;
  /** Folded on phones, so the conversation stays near the top. */
  fold?: boolean;
  /** A small "⋯" menu at the section's top right. */
  menu?: ReactNode;
  children: ReactNode;
}) {
  const phone = useIsPhone();
  if (fold && phone) return <FoldedSection title={title}>{children}</FoldedSection>;
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-3 border border-border-subtle bg-surface p-6 max-md:p-4"
    >
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {menu && <div className="-my-1.5 -mr-2">{menu}</div>}
      </div>
      {children}
    </section>
  );
}

/** Scrolls to a mail of the conversation and flashes it, so the user sees which mail asks. */
function showMail(gmailMessageId: string) {
  const mail = document.getElementById(`mail-${gmailMessageId}`);
  if (!mail) return;
  mail.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  mail.classList.remove('animate-flash');
  void mail.offsetWidth;
  mail.classList.add('animate-flash');
}

/** "From Priya's mail, Oct 11, 10:42 AM": jumps to the mail that asks. */
function AskingMailLink({ mail, messageId }: { mail: ConversationMail; messageId: string }) {
  return (
    <button
      type="button"
      onClick={() => showMail(messageId)}
      className="flex cursor-pointer items-center gap-1.5 border-t border-border-subtle pt-3 text-left text-sm text-link"
    >
      <ArrowDown size={16} aria-hidden="true" />
      From {mail.sender ? `${parseSender(mail.sender).name}'s` : 'this'} mail,{' '}
      {mailDateTime(mail.receivedAt)}
    </button>
  );
}

/** Jumps to the mail or reply that closed a request, as the asking mail's link does. */
function ClosedByLink({ asked }: { asked: ConversationRequest }) {
  const messageId = asked.closedByMessageId;
  if (!messageId) return null;
  return (
    <button
      type="button"
      onClick={() => showMail(messageId)}
      className="flex cursor-pointer items-center gap-1.5 border-t border-border-subtle pt-3 text-left text-sm text-link"
    >
      <ArrowDown size={16} aria-hidden="true" />
      {asked.closedReason === 'YOUR_REPLY' ? 'Show your reply' : 'Show that mail'}
    </button>
  );
}

/** What closes an open request, or what became of the user's reply (owner, 24 Oct 2026). */
function stepNote(asked: ConversationRequest, pastDue: boolean): string | null {
  if (asked.state === 'REPLIED')
    return asked.replyRead === 'NOT_READ'
      ? "The AI could not read your reply, so it can't tell if this is done."
      : null;
  if (asked.state !== 'OPEN') return null;
  if (asked.replyRead === 'NOT_ANSWERED' && asked.repliedAt)
    return `${repliedLine(asked.repliedAt)}, but your reply does not answer this yet.`;
  if (asked.askKind === 'REPLY_BY_MAIL')
    return pastDue
      ? 'Closes when your reply answers it, or when you set the application to Rejected or Closed.'
      : 'Closes by itself when your reply answers it.';
  if (asked.askKind === 'OUTSIDE_MAIL' && asked.canReply)
    return 'Closes by itself when you reply that you did it, or when they confirm it.';
  return asked.canReply
    ? 'When you have done it, choose "I did this" in "⋯".'
    : 'This sender can\'t get a reply. When you\'ve done it, choose "I did this" in "⋯".';
}

/** When an open request is due, in red once it is past due. */
function StepDue({ asked }: { asked: ConversationRequest }) {
  if (asked.state !== 'OPEN' || !asked.deadline) return null;
  const pastDue = requestPastDue(asked);
  return (
    <p className={cn('flex items-center gap-2 text-sm', pastDue && 'text-danger-text')}>
      <Calendar size={16} aria-hidden="true" />
      {requestDetail(asked)}
      <span className={cn('text-xs', !pastDue && 'text-text-secondary')}>
        {dueIn(asked.deadline, new Date())}
      </span>
    </p>
  );
}

/** Where the request stands: its state, with when the user replied or why it closed. */
function StepState({ asked, fake }: { asked: ConversationRequest; fake: boolean }) {
  const replied = asked.state === 'REPLIED' && requestDetail(asked);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <TodoState state={asked.state} fakeOffer={fake} />
      {replied && <span className="text-xs text-text-secondary">{replied}</span>}
      {asked.state === 'DONE' && asked.closedReason && (
        <span className="text-xs text-text-secondary">
          {CLOSED_REASON_LABEL[asked.closedReason]}
          {asked.closedAt && ` · ${mailDateTime(asked.closedAt)}`}
        </span>
      )}
    </div>
  );
}

/** "GPT-6 Luna · Reading your reply", in the app's grey AI look, while the AI reads the reply. */
function ReadingReply({ detail }: { detail: ConversationDetail }) {
  const { analyzedBy, request } = detail.conversation;
  if (request?.state !== 'REPLIED' || request.replyRead !== 'WAITING') return null;
  return (
    <p className="flex items-center gap-1.5 text-xs">
      <span className="text-text-secondary">
        {analyzedBy ? modelName(analyzedBy.provider, analyzedBy.model) : 'AI'} ·
      </span>
      <span className="ai-shimmer">Reading your reply</span>
    </p>
  );
}

/** The mail a link under the step jumps to: the one that closed it, or the one that asks. */
function StepSourceLink({ detail }: { detail: ConversationDetail }) {
  const asked = detail.conversation.request!;
  if (asked.state === 'DONE') return <ClosedByLink asked={asked} />;
  const source = detail.mails.find((mail) => mail.id === asked.emailId);
  const messageId = askingMessageId(detail);
  return source && messageId ? <AskingMailLink mail={source} messageId={messageId} /> : null;
}

/** What the conversation needs now: the request, its due date, its state and what closes it. */
function NextStep({ detail }: { detail: ConversationDetail }) {
  const { conversation } = detail;
  const change = useSetRequestState(conversation.key);
  const asked = conversation.request;
  if (!asked) {
    const schedule = scheduleLine(conversation);
    return (
      <PanelSection title="Next step">
        <p className="text-base">{schedule ?? 'Nothing needed from you'}</p>
      </PanelSection>
    );
  }
  const title = requestTitle(asked);
  const fake = fakeOfferStep(conversation);
  const note = fake ? null : stepNote(asked, requestPastDue(asked));
  const setState = (state: 'DONE' | 'OPEN', toast: string) =>
    change.mutate({ emailId: asked.emailId, state }, { onSuccess: () => showToast(toast) });
  // "I did this" only on an open request done outside mail; never a big button.
  const menu =
    asked.state === 'OPEN' && closesByHand(asked) && !fake ? (
      <OverflowMenu
        label={`More for ${title}`}
        actions={[
          {
            label: 'I did this',
            disabled: change.isPending,
            onSelect: () => setState('DONE', `Done: ${title}`),
          },
        ]}
      />
    ) : undefined;
  const again = asked.state === 'DONE' ? 'Reopen' : 'Ask me again';
  return (
    <PanelSection title="Next step" menu={menu}>
      <p className={cn('text-base break-words', asked.state === 'DONE' && 'text-text-secondary')}>
        {title}
      </p>
      {!fake && <StepDue asked={asked} />}
      <StepState asked={asked} fake={fake} />
      <ReadingReply detail={detail} />
      {note && <p className="text-xs text-text-secondary">{note}</p>}
      {asked.state !== 'OPEN' && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            variant="ghost"
            aria-label={`${again}: ${title}`}
            loading={change.isPending}
            onClick={() => setState('OPEN', asked.state === 'DONE' ? 'Reopened' : 'Asked again')}
          >
            {again}
          </Button>
        </div>
      )}
      {fake && <p className="text-xs text-text-secondary">{FAKE_OFFER.stepNote}</p>}
      {change.isError && !isOfflineError(change.error) && (
        <InlineNotification kind="error">
          Could not update: {change.error.message}
        </InlineNotification>
      )}
      <StepSourceLink detail={detail} />
    </PanelSection>
  );
}

/**
 * The job side of a mail's details, beside the conversation: what to do now, the dates the
 * mails name, and the application. What the AI read sits under each mail instead.
 */
export function JobMailPanel({ detail }: { detail: ConversationDetail }) {
  const { conversation, mails } = detail;
  const canCreate = !conversation.application && conversation.link !== 'IGNORED';
  // Later mails never join a probable fake offer's application by themselves.
  const oneClick = canCreate && conversation.fakeOfferWarning === null;
  const dates = keyDates(mails);
  return (
    // On phones it sits above the conversation: the next step first, the rest folded.
    <aside
      aria-label="About this job mail"
      className="flex flex-col gap-4 max-md:order-first max-md:gap-2 lg:sticky lg:top-20"
    >
      <NextStep detail={detail} />
      {dates.length > 0 && (
        <PanelSection title="Key dates" fold>
          <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            {dates.map((date) => (
              <div key={date.label} className="contents">
                <dt className="text-text-secondary">{date.label}</dt>
                <dd className="break-words">{date.value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-text-secondary">As the mails wrote them.</p>
        </PanelSection>
      )}
      <PanelSection title="Application" fold>
        {canCreate && <p className="text-sm">This conversation has no application yet.</p>}
        <ConversationApplication conversation={conversation} />
        {oneClick && (
          <p className="text-xs text-text-secondary">
            One click. The details come from this mail. Later mails from the same company join it by
            themselves.
          </p>
        )}
      </PanelSection>
    </aside>
  );
}
