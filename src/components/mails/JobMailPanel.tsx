import { useState, type ReactNode } from 'react';
import { ArrowDown, Calendar, ChevronDown } from '@carbon/icons-react';
import { useSetRequestState } from '../../api/conversations';
import type { ConversationDetail, ConversationMail } from '../../contracts/conversation';
import { askingMessageId, dueIn, keyDates } from '../../lib/mailThread';
import {
  FAKE_OFFER,
  fakeOfferStep,
  mailDateTime,
  parseSender,
  requestControls,
  requestDetail,
  requestTitle,
  scheduleLine,
} from '../../lib/mails';
import { cn } from '../../lib/utils';
import { useIsPhone } from '../layout/useIsPhone';
import { Button } from '../ui/button';
import { Collapse } from '../ui/collapse';
import { InlineNotification } from '../ui/notification';
import { showToast } from '../ui/toast';
import { ConversationApplication } from './ConversationApplication';
import { TodoState } from './TodoState';

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
  children,
}: {
  title: string;
  /** Folded on phones, so the conversation stays near the top. */
  fold?: boolean;
  children: ReactNode;
}) {
  const phone = useIsPhone();
  if (fold && phone) return <FoldedSection title={title}>{children}</FoldedSection>;
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-3 border border-border-subtle bg-surface p-6 max-md:p-4"
    >
      <h2 className="mb-1 text-sm font-semibold">{title}</h2>
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

/** What the conversation needs now: the request, its due date, its state and the buttons. */
function NextStep({ detail }: { detail: ConversationDetail }) {
  const { conversation, mails } = detail;
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
  const detailLine = requestDetail(asked);
  const source = mails.find((mail) => mail.id === asked.emailId);
  const messageId = askingMessageId(detail);
  const fake = fakeOfferStep(conversation);
  return (
    <PanelSection title="Next step">
      <p className="text-base break-words">{title}</p>
      {asked.state === 'OPEN' && asked.deadline && !fake && (
        <p className="flex items-center gap-2 text-sm">
          <Calendar size={16} aria-hidden="true" />
          {detailLine}
          <span className="text-xs text-text-secondary">{dueIn(asked.deadline, new Date())}</span>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <TodoState state={asked.state} fakeOffer={fake} />
        {asked.state === 'REPLIED' && detailLine && (
          <span className="text-xs text-text-secondary">{detailLine}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        {requestControls(asked.state, true).map((control, index) => (
          <Button
            key={control.label}
            size="sm"
            variant={index === 0 && control.state === 'DONE' ? 'secondary' : 'ghost'}
            aria-label={`${control.label}: ${title}`}
            loading={change.isPending && change.variables?.state === control.state}
            disabled={change.isPending}
            onClick={() =>
              change.mutate(
                { emailId: asked.emailId, state: control.state },
                {
                  onSuccess: () =>
                    showToast(control.state === 'DONE' ? 'Marked done' : 'Asked again'),
                },
              )
            }
          >
            {control.label}
          </Button>
        ))}
      </div>
      {fake && <p className="text-xs text-text-secondary">{FAKE_OFFER.stepNote}</p>}
      {asked.state === 'REPLIED' && (
        <p className="text-xs text-text-secondary">
          We saw that you replied. We do not read what you wrote.
        </p>
      )}
      {change.isError && (
        <InlineNotification kind="error">
          Could not update: {change.error.message}
        </InlineNotification>
      )}
      {source && messageId && <AskingMailLink mail={source} messageId={messageId} />}
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
