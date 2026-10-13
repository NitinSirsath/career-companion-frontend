import { Link } from '@tanstack/react-router';
import { parseSender } from '../../lib/mails';
import { SandboxThreadMailForm } from './SandboxThreadMailForm';

/**
 * Mail written in the open sandbox conversation. Only the other person writes here: the user
 * replies from the mail's own page in the app, as they would with real Gmail, so nothing in the
 * sandbox sends a mail as the user.
 */
export function SandboxReplyForm({ threadId, party }: { threadId: string; party: string }) {
  return (
    <>
      <SandboxThreadMailForm
        threadId={threadId}
        title={`Next mail from ${party}`}
        send={`Send as ${parseSender(party).name}`}
      />
      <p className="text-sm text-text-secondary">
        To reply as yourself,{' '}
        <Link
          to="/mails/gmail/$threadId"
          params={{ threadId }}
          className="font-medium text-action-primary hover:underline"
        >
          open this conversation on the Mails page
        </Link>
        .
      </p>
    </>
  );
}
