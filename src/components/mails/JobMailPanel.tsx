import { useState, type ReactNode } from 'react';
import { ArrowDownIcon, ChevronDownIcon } from 'lucide-react';
import { useSetRequestState } from '../../api/conversations';
import type {
  ConversationDetail,
  ConversationMail,
  ConversationRequest,
} from '../../contracts/conversation';
import { showMail, stepNote } from '../../lib/jobStep';
import { askingMessageId, keyDates } from '../../lib/mailThread';
import {
  FAKE_OFFER,
  fakeOfferStep,
  closesByHand,
  mailDateTime,
  parseSender,
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
import { ReadingReply, StepDue, StepState } from './StepParts';
import { isOfflineError } from '../../lib/offline';

/** On phones a card that folds: its title is a button, the rest opens under it. */
function FoldedSection({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-label={title} className="panel">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-h-13 w-full cursor-pointer items-center justify-between gap-3 px-4 text-left text-sm font-semibold"
        >
          {title}
          <ChevronDownIcon
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
    <section aria-label={title} className="flex flex-col gap-3 panel p-6 max-md:p-4">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {menu && <div className="-my-1.5 -mr-2">{menu}</div>}
      </div>
      {children}
    </section>
  );
}

/** "From Priya's mail, Oct 11, 10:42 AM": jumps to the mail that asks. */
function AskingMailLink({ mail, messageId }: { mail: ConversationMail; messageId: string }) {
  return (
    <button
      type="button"
      onClick={() => showMail(messageId)}
      className="flex cursor-pointer items-center gap-1.5 border-t border-border-subtle pt-3 text-left text-sm text-link"
    >
      <ArrowDownIcon size={16} aria-hidden="true" />
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
      <ArrowDownIcon size={16} aria-hidden="true" />
      {asked.closedReason === 'YOUR_REPLY' ? 'Show your reply' : 'Show that mail'}
    </button>

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
            aria-label={`Reopen: ${title}`}
            loading={change.isPending}
            onClick={() => setState('OPEN', `Reopened: ${title}`)}
          >
            Reopen
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
  // Phones: a mail with no application yet keeps this card open, right under the next step, so
  // "Create application" is in view (owner, 7 Nov 2026). A probable fake offer stays folded.
  const openOnPhone = useIsPhone() && oneClick;
  const applicationCard = (
    <PanelSection title="Application" fold={!oneClick}>
      {canCreate && <p className="text-sm">This conversation has no application yet.</p>}
      <ConversationApplication conversation={conversation} />
      {oneClick && (
        <p className="text-xs text-text-secondary">
          One click. The details come from this mail. Later mails from the same company join it by
          themselves.
        </p>
      )}
    </PanelSection>
  );
  return (
    // On phones it sits above the conversation: the next step first, the rest folded.
    <aside
      aria-label="About this job mail"
      className="flex flex-col gap-4 max-md:order-first max-md:gap-2 lg:sticky lg:top-20"
    >
      <NextStep detail={detail} />
      {openOnPhone && applicationCard}
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
      {!openOnPhone && applicationCard}
    </aside>
  );
}
