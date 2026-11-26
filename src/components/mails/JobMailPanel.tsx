import { useState, type ReactNode } from 'react';
import { ArrowDownIcon, ChevronDownIcon } from 'lucide-react';
import { useSetRequestState } from '../../api/conversations';
import type {
  ConversationDetail,
  ConversationMail,
  ConversationRequest,
} from '../../contracts/conversation';
import { closedByYourReply, showMail, stepNote } from '../../lib/jobStep';
import { askingMessageId, keyDates, keyDatesNote } from '../../lib/mailThread';
import {
  CAREER_CONTACT,
  careerContact,
  noApplicationLine,
  FAKE_OFFER,
  fakeOfferStep,
  closesByHand,
  mailDateTime,
  parseSender,
  REQUEST_STATE_LABEL,
  requestDetail,
  requestPastDue,
  requestTitle,
  scheduleLine,
} from '../../lib/mails';
import { MISSED, missedNote, missedWhy } from '../../lib/missed';
import { cn } from '../../lib/utils';
import { useIsPhone } from '../layout/useIsPhone';
import { Button } from '../ui/button';
import { Collapse } from '../ui/collapse';
import { ReanalyzeLine } from '../reanalysis/ReanalyzeLine';
import { OverflowMenu } from '../ui/menu';
import { Ring } from '../ui/ring';
import { InlineNotification } from '../ui/notification';
import { showToast } from '../ui/toast';
import { ConversationApplication } from './ConversationApplication';
import { FakeOfferTag } from './FakeOffer';
import { ReadingReply, StepDue } from './StepParts';
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
    // Laptops (laptop v2, 18 Nov 2026): a flat grey card with a small grey heading.
    <section aria-label={title} className="flex flex-col gap-2.5 panel p-3.5 max-md:p-4">
      <div className="flex min-h-5 items-center justify-between gap-3">
        <h2 className="text-xs font-semibold text-text-secondary">{title}</h2>
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
      {closedByYourReply(asked) ? 'Show your reply' : 'Show that mail'}
    </button>
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

/**
 * Where the step stands, in grey words under it: "Needs action", "↩ You replied Nov 13", "Done ·
 * Your reply answered it", "Missed · was due Nov 17, 2026 11:00 AM". No coloured label; a fake
 * offer's open step says Probably fake.
 */
function StepStateLine({ asked, fake }: { asked: ConversationRequest; fake: boolean }) {
  if (asked.state === 'OPEN' && fake) return <FakeOfferTag />;
  if (asked.missed)
    return (
      <p className="flex flex-wrap gap-x-1 text-xs text-text-secondary">
        <span>{MISSED.label}</span>
        <span aria-hidden="true">·</span>
        <span>{missedWhy(asked)}</span>
      </p>
    );
  const detail = asked.state === 'OPEN' ? null : requestDetail(asked);
  return (
    <p className="flex flex-wrap gap-x-1 text-xs text-text-secondary">
      <span>
        {asked.state === 'REPLIED' && <span aria-hidden="true">↩ </span>}
        {REQUEST_STATE_LABEL[asked.state]}
      </span>
      {detail && (
        <>
          <span aria-hidden="true">·</span>
          <span>
            {detail}
            {asked.state === 'DONE' && asked.closedAt && ` · ${mailDateTime(asked.closedAt)}`}
          </span>
        </>
      )}
    </p>
  );
}

/**
 * The Next step's ⋯ menu: "I did this" only on an open request done outside mail (never a big
 * button). Reading a reply again is Reanalyze, in the conversation's own ⋯ menu.
 */
function StepMenu({
  asked,
  fake,
  onDone,
  doing,
}: {
  asked: ConversationRequest;
  fake: boolean;
  onDone: () => void;
  doing: boolean;
}) {
  if (asked.state !== 'OPEN' || !closesByHand(asked) || fake) return null;
  return (
    <OverflowMenu
      label={`More for ${requestTitle(asked)}`}
      actions={[{ label: 'I did this', disabled: doing, onSelect: onDone }]}
    />
  );
}

/**
 * The way back to the list, under a step: Reopen once it is closed, and Still open, in the same
 * place, while it is missed.
 */
function StepBack({
  asked,
  busy,
  onBack,
}: {
  asked: ConversationRequest;
  busy: boolean;
  onBack: (said: string) => void;
}) {
  if (asked.state === 'OPEN' && !asked.missed) return null;
  const label = asked.missed ? MISSED.stillOpen : 'Reopen';
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <Button
        size="sm"
        variant="ghost"
        aria-label={\`${label}: ${requestTitle(asked)}\`}
        loading={busy}
        onClick={() => onBack(asked.missed ? MISSED.stillOpen : 'Reopened')}
      >
        {label}
      </Button>
    </div>
  );
}

/** Under the step: why a missed one left the list (and the day), else what closes it. */
function panelNote(asked: ConversationRequest): string | null {
  if (asked.missed) return missedNote(asked.missed, true);
  return stepNote(asked, requestPastDue(asked));
}

/**
 * What the conversation needs now: the request, its due date, its state and what closes it. A
 * closed step has Reopen; a missed one is dim and has Still open in the same place.
 */
function NextStep({ detail }: { detail: ConversationDetail }) {
  const { conversation } = detail;
  const change = useSetRequestState(conversation.key);
  const asked = conversation.request;
  if (!asked) {
    const schedule = scheduleLine(conversation);
    return (
      <PanelSection title="Next step">
        <p className="text-sm">{schedule ?? 'Nothing needed from you'}</p>
        <ReanalyzeLine target={{ kind: 'conversation', key: conversation.key }} />
      </PanelSection>
    );
  }
  const title = requestTitle(asked);
  const fake = fakeOfferStep(conversation);
  const note = fake ? null : panelNote(asked);
  const missed = asked.missed !== null;
  const setState = (state: 'DONE' | 'OPEN', toast: string) =>
    change.mutate({ emailId: asked.emailId, state }, { onSuccess: () => showToast(toast) });
  const menu = (
    <StepMenu
      asked={asked}
      fake={!!fake}
      onDone={() => setState('DONE', `Done: ${title}`)}
      doing={change.isPending}
    />
  );
  return (
    <PanelSection title="Next step" menu={menu}>
      {/* Laptop v2 (18 Nov 2026): a ring before the step, its state in grey words under it. */}
      <div className="flex items-start gap-2.5">
        <Ring
          kind={asked.state === 'OPEN' ? 'todo' : 'offer'}
          size={14}
          className={cn('mt-[3px]', missed && 'opacity-55')}
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-sm break-words',
              (asked.state === 'DONE' || missed) && 'text-text-secondary',
            )}
          >
            {title}
          </p>
          <StepStateLine asked={asked} fake={fake} />
        </div>
      </div>
      {!fake && <StepDue asked={asked} />}
      <ReadingReply detail={detail} />
      <ReanalyzeLine target={{ kind: 'conversation', key: conversation.key }} />
      {note && <p className="text-xs text-text-secondary">{note}</p>}
      <StepBack
        asked={asked}
        busy={change.isPending}
        onBack={(said) => setState('OPEN', \`${said}: ${title}\`)}
      />
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
  const contact = careerContact(conversation);
  const canCreate = !conversation.application && conversation.link !== 'IGNORED' && !contact;
  // Later mails never join a probable fake offer's application by themselves.
  const oneClick = canCreate && conversation.fakeOfferWarning === null;
  const offered = conversation.sameCompanyApplications.length > 0;
  const dates = keyDates(mails, conversation.request);
  // Phones: a mail with no application yet keeps this card open, right under the next step, so
  // "Create application" is in view (owner, 7 Nov 2026). A probable fake offer stays folded.
  const openOnPhone = useIsPhone() && oneClick;
  const applicationCard = contact ? (
    <PanelSection title="About this mail" fold>
      <p className="text-sm">{CAREER_CONTACT.about(conversation.sender)}</p>
    </PanelSection>
  ) : (
    <PanelSection title="Application" fold={!oneClick}>
      {canCreate && <p className="text-sm">{noApplicationLine(conversation)}</p>}
      <ConversationApplication conversation={conversation} />
      {oneClick && !offered && (
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
      className="flex flex-col gap-3 max-md:order-first max-md:gap-2 lg:sticky lg:top-20"
    >
      <NextStep detail={detail} />
      {openOnPhone && applicationCard}
      {dates.length > 0 && (
        <PanelSection title="Key dates" fold>
          <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            {dates.map((date) => (
              <div key={date.label} className="contents">
                <dt className="text-text-secondary">{date.label}</dt>
                <dd className="break-words">
                  {date.value}
                  {date.state && <span className="text-text-tertiary"> · {date.state}</span>}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-text-secondary">{keyDatesNote(dates)}</p>
        </PanelSection>
      )}
      {!openOnPhone && applicationCard}
    </aside>
  );
}
