import { useConversationSummary } from '../../api/conversations';
import type { MailsSearch } from '../../lib/mails';
import { missedCount } from '../../lib/missed';

type RequestFilter = MailsSearch['request'];

/**
 * "4 mails need you, 2 are past due. 2 missed. Everything else is up to date." under the Mails
 * title (owner, 3 Nov 2026), counted by the server over all mails. "4 mails need you" turns the
 * Needs action filter on and off; "2 missed" does the same for the Missed filter (owner, 26 Nov
 * 2026): those left Needs action by themselves and are counted in no other number.
 */
export function MailSummary({
  request,
  onRequest,
}: {
  /** The Action filter in use. */
  request: RequestFilter;
  onRequest: (request: RequestFilter) => void;
}) {
  const { data } = useConversationSummary();
  if (!data) return null;
  const { needsAction, pastDue, missed } = data;
  const toggle = (value: 'open' | 'missed', words: string) => (
    <button
      type="button"
      aria-pressed={request === value}
      onClick={() => onRequest(request === value ? undefined : value)}
      className="cursor-pointer font-medium text-text-primary underline decoration-border-default underline-offset-4 hover:decoration-text-primary"
    >
      {words}
    </button>
  );
  const missedPart = missed > 0 && <> {toggle('missed', missedCount(missed))}.</>;
  if (needsAction === 0)
    return (
      <>
        Nothing needs you right now.{missedPart} Everything {missed > 0 && 'else '}is up to date.
      </>
    );
  return (
    <>
      {toggle('open', needsAction === 1 ? '1 mail needs you' : `${needsAction} mails need you`)}
      {pastDue > 0 && (
        <>
          ,{' '}
          <span className="text-danger-text">
            {pastDue === 1 ? '1 is past due' : `${pastDue} are past due`}
          </span>
        </>
      )}
      .{missedPart} Everything else is up to date.
    </>
  );
}
