import type { ReactNode } from 'react';
import { ArrowDown, Calendar } from '@carbon/icons-react';
import { useSetRequestState } from '../../api/conversations';
import type { ConversationDetail } from '../../contracts/conversation';
import { askingMessageId, dueIn, keyDates } from '../../lib/mailThread';
import {
  mailDateTime,
  parseSender,
  requestControls,
  requestDetail,
  requestTitle,
  scheduleLine,
} from '../../lib/mails';
import { Button } from '../ui/button';
import { InlineNotification } from '../ui/notification';
import { showToast } from '../ui/toast';
import { ConversationApplication } from './ConversationApplication';
import { TodoState } from './TodoState';

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 bg-surface px-6 py-5">
      <h2 className="text-xs tracking-[0.32px] text-text-secondary">{title}</h2>
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

/** What the conversation needs now: the request, its due date, its state and the buttons. */
function NextStep({ detail }: { detail: ConversationDetail }) {
  const { conversation, mails } = detail;
  const change = useSetRequestState(conversation.key);
  const asked = conversation.request;
  if (!asked) {
    const schedule = scheduleLine(conversation);
    return (
      <PanelSection title="Next step">
        <p className="text-xl leading-7">{schedule ?? 'Nothing needed from you'}</p>
      </PanelSection>
    );
  }
  const title = requestTitle(asked);
  const detailLine = requestDetail(asked);
  const source = mails.find((mail) => mail.id === asked.emailId);
  const messageId = askingMessageId(detail);
  return (
    <PanelSection title="Next step">
      <p className="text-xl leading-7 break-words">{title}</p>
      {asked.state === 'OPEN' && asked.deadline && (
        <p className="flex items-center gap-2 text-sm">
          <Calendar size={16} aria-hidden="true" />
          {detailLine}
          <span className="text-xs text-text-secondary">{dueIn(asked.deadline, new Date())}</span>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <TodoState state={asked.state} />
        {asked.state === 'REPLIED' && detailLine && (
          <span className="text-xs text-text-secondary">{detailLine}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        {requestControls(asked.state, true).map((control, index) => (
          <Button
            key={control.label}
            variant={index === 0 && control.state === 'DONE' ? 'primary' : 'ghost'}
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
      {source && messageId && (
        <button
          type="button"
          onClick={() => showMail(messageId)}
          className="flex cursor-pointer items-center gap-1.5 border-t border-border-subtle pt-3 text-left text-sm text-link"
        >
          <ArrowDown size={16} aria-hidden="true" />
          From {source.sender ? `${parseSender(source.sender).name}'s` : 'this'} mail,{' '}
          {mailDateTime(source.receivedAt)}
        </button>
      )}
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
  const dates = keyDates(mails);
  return (
    <aside aria-label="About this job mail" className="flex flex-col gap-4 lg:sticky lg:top-6">
      <NextStep detail={detail} />
      {dates.length > 0 && (
        <PanelSection title="Key dates">
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
      <PanelSection title="Application">
        {canCreate && <p className="text-sm">This conversation has no application yet.</p>}
        <ConversationApplication conversation={conversation} />
        {canCreate && (
          <p className="text-xs text-text-secondary">
            One click. The details come from this mail. Later mails from the same company join it by
            themselves.
          </p>
        )}
      </PanelSection>
    </aside>
  );
}
