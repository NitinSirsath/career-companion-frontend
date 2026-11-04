import { useConversationSummary } from '../../api/conversations';

/**
 * "4 mails need you, 2 are past due. Everything else is up to date." under the Mails title (owner,
 * 3 Nov 2026), counted by the server over all mails. "4 mails need you" turns the Needs action
 * filter on and off.
 */
export function MailSummary({
  needsActionOn,
  onToggleNeedsAction,
}: {
  needsActionOn: boolean;
  onToggleNeedsAction: () => void;
}) {
  const { data } = useConversationSummary();
  if (!data) return null;
  const { needsAction, pastDue } = data;
  if (needsAction === 0) return <>Nothing needs you right now. Everything is up to date.</>;
  return (
    <>
      <button
        type="button"
        aria-pressed={needsActionOn}
        onClick={onToggleNeedsAction}
        className="cursor-pointer font-medium text-text-primary underline decoration-border-default underline-offset-4 hover:decoration-text-primary"
      >
        {needsAction === 1 ? '1 mail needs you' : `${needsAction} mails need you`}
      </button>
      {pastDue > 0 && (
        <>
          ,{' '}
          <span className="text-danger-text">
            {pastDue === 1 ? '1 is past due' : `${pastDue} are past due`}
          </span>
        </>
      )}
      . Everything else is up to date.
    </>
  );
}
