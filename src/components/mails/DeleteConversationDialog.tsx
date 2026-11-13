import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useDeleteConversation } from '../../api/removal';
import { isApiError } from '../../api/client';
import type { Conversation } from '../../contracts/conversation';
import { isOfflineError } from '../../lib/offline';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { InlineNotification } from '../ui/notification';
import { showToast } from '../ui/toast';

/**
 * "Delete from NorthList", with the choice to also block the company. Gmail is not changed, and
 * later mails in the conversation still come in.
 */
export function DeleteConversationDialog({
  conversation,
  domain,
  open,
  onClose,
}: {
  conversation: Conversation;
  /** The company a block would cover; null for LinkedIn and shared mail providers. */
  domain: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [alsoBlock, setAlsoBlock] = useState(false);
  const remove = useDeleteConversation(conversation.key);
  const navigate = useNavigate();
  const close = () => {
    if (remove.isPending) return;
    remove.reset();
    setAlsoBlock(false);
    onClose();
  };
  const confirm = () =>
    remove.mutate(
      { block: alsoBlock && !!domain },
      {
        onSuccess: (result) => {
          showToast(
            result.blocked
              ? `Deleted. New mails from ${result.blocked} are blocked.`
              : 'Deleted from NorthList.',
          );
          void navigate({ to: '/mails' });
        },
      },
    );
  const failure =
    remove.error && isApiError(remove.error) && remove.error.code === 'MAIL_BEING_READ'
      ? remove.error.message
      : 'We could not confirm the delete. Close this and look at the conversation again.';
  return (
    <Dialog open={open} onOpenChange={(value) => !value && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this conversation from NorthList?</DialogTitle>
          <DialogDescription>
            This removes the conversation and everything the app took from it:
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
          <li>
            {conversation.mailCount === 1
              ? 'its mail, with its subject and sender'
              : `its ${conversation.mailCount} mails, their subjects and senders`}
          </li>
          <li>the steps, history entries and dates from them</li>
        </ul>
        <p className="mt-4 text-sm text-text-secondary">
          Your Gmail is not changed. New mails in this conversation still come in.
        </p>
        {domain && (
          <div className="mt-4 flex items-start gap-2">
            <input
              id="delete-also-block"
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-border-focus"
              checked={alsoBlock}
              onChange={(event) => setAlsoBlock(event.target.checked)}
            />
            <Label htmlFor="delete-also-block" className="leading-snug">
              Also stop reading new mails from <strong>{domain}</strong>
              <span className="block text-xs text-text-secondary">
                You can unblock it in Mails › Restricted.
              </span>
            </Label>
          </div>
        )}
        {remove.isError && !isOfflineError(remove.error) && (
          <InlineNotification kind="error" className="mt-6">
            {failure}
          </InlineNotification>
        )}
        <DialogFooter>
          <Button variant="secondary" disabled={remove.isPending} onClick={close}>
            Cancel
          </Button>
          <Button variant="danger" loading={remove.isPending} onClick={confirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
