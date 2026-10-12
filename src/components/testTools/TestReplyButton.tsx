import { useDeliverTestReply, useTestToolsEnabled } from '../../api/testTools';
import { isSimulatedId } from '../../contracts/testTools';
import { failureNotice } from '../../lib/testInbox';
import { Button } from '../ui/button';

/** Test environment only: records a reply in a test thread, as a Gmail sync records sent mail. */
export function TestReplyButton({ threadId }: { threadId: string }) {
  const enabled = useTestToolsEnabled();
  const reply = useDeliverTestReply();
  if (!enabled || !isSimulatedId(threadId)) return null;
  return (
    <div className="space-y-1">
      <Button
        variant="tertiary"
        size="sm"
        disabled={reply.isPending}
        onClick={() => reply.mutate(threadId)}
      >
        Record my reply (test)
      </Button>
      {reply.isError && (
        <p role="alert" className="text-xs">
          {failureNotice('record the reply', reply.error)}
        </p>
      )}
    </div>
  );
}
