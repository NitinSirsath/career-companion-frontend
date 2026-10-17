import type { ReactNode } from 'react';
import type { ConversationDetail, ConversationMail } from '../../contracts/conversation';
import { aiReading, mailDateTime } from '../../lib/mails';
import { AnalyzedBy } from '../ai/AnalyzedBy';
import { ConversationAction } from './ConversationAction';
import { ConversationApplication } from './ConversationApplication';

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-border-default p-4 space-y-3">
      <h2 className="text-xs font-semibold text-text-secondary">{title}</h2>
      {children}
    </section>
  );
}

function AiReading({ mail, only }: { mail: ConversationMail; only: boolean }) {
  const rows = aiReading(mail);
  const which = only ? 'this mail' : `the mail of ${mailDateTime(mail.receivedAt)}`;
  return (
    <PanelSection title={`What the AI read in ${which}`}>
      {rows.length === 0 && <p className="text-sm">The AI read nothing more from this mail.</p>}
      <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-text-secondary">{row.label}</dt>
            <dd className="col-span-2 break-words">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-text-secondary">
        This is the AI's reading, not the mail's own words.
      </p>
      <AnalyzedBy provider={mail.analyzedBy?.provider} model={mail.analyzedBy?.model} details />
    </PanelSection>
  );
}

/** The job side of a mail's details: what it needs, its application, and what the AI read. */
export function JobMailPanel({ detail }: { detail: ConversationDetail }) {
  const { conversation, mails } = detail;
  const canCreate = !conversation.application && conversation.link !== 'IGNORED';
  return (
    <aside aria-label="About this job mail" className="space-y-4">
      <PanelSection title="What this mail needs from you">
        <ConversationAction conversation={conversation} detailed />
      </PanelSection>
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
      {/* Newest first: the newest mail is the one the action and the type come from. */}
      {[...mails].reverse().map((mail) => (
        <AiReading key={mail.id} mail={mail} only={mails.length === 1} />
      ))}
    </aside>
  );
}
