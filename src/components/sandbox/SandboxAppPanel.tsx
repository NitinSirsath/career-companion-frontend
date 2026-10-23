import { Link } from '@tanstack/react-router';
import type { SandboxMessage } from '../../contracts/sandbox';
import { mailDateTime, parseSender } from '../../lib/mails';
import { jobLine, mailStateDetail } from '../../lib/sandbox';
import { FakeOfferTag } from '../mails/FakeOffer';
import { SandboxMailState } from './SandboxMailState';

function MailResult({ message }: { message: SandboxMessage }) {
  const { result } = message;
  const detail = mailStateDetail(result);
  const who = message.sentByUser
    ? `Me to ${parseSender(message.to).name}`
    : `${parseSender(message.from).name} to me`;
  return (
    <li className="space-y-2 border border-border-subtle bg-surface p-3 text-sm">
      <p className="text-text-secondary">
        {mailDateTime(message.date)} · {who}
      </p>
      <SandboxMailState state={result.state} />
      {detail && <p>{detail}</p>}
      {result.job && (
        <>
          {jobLine(result.job) && <p>{jobLine(result.job)}</p>}
          {result.job.fakeOfferWarning && (
            <div className="space-y-1">
              <FakeOfferTag />
              <p className="break-words">{result.job.fakeOfferWarning}</p>
            </div>
          )}
          <p>
            <span className="text-text-secondary">Action: </span>
            {result.job.requestedAction ?? 'Nothing asked'}
          </p>
          <p>
            <span className="text-text-secondary">Application: </span>
            {result.job.application ? (
              <Link
                to="/applications/$id"
                params={{ id: result.job.application.id }}
                className="font-medium text-action-primary hover:underline"
              >
                {[result.job.application.companyName, result.job.application.jobTitle]
                  .filter(Boolean)
                  .join(', ')}
              </Link>
            ) : (
              'None yet'
            )}
          </p>
        </>
      )}
    </li>
  );
}

/** For each mail of the conversation: what the app did with it. Read from the app, never made up. */
export function SandboxAppPanel({ messages }: { messages: SandboxMessage[] }) {
  const tracked = messages.find((message) => message.result.job)?.result.job;
  return (
    <aside
      aria-label="What the app did"
      className="space-y-3 border border-border-default bg-surface-subtle p-4 xl:w-80 xl:shrink-0"
    >
      <h2 className="text-base font-semibold">What the app did</h2>
      <ul className="space-y-3">
        {messages.map((message) => (
          <MailResult key={message.id} message={message} />
        ))}
      </ul>
      {tracked && (
        <Link
          to="/mails/$key"
          params={{ key: tracked.conversationKey }}
          className="inline-block text-sm font-medium text-action-primary hover:underline"
        >
          Open this conversation on the Mails page
        </Link>
      )}
    </aside>
  );
}
