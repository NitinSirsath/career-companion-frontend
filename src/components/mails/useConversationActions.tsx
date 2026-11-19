import { useRef, useState } from 'react';
import { useAISettings } from '../../api/aiSettings';
import { useReanalyzing } from '../../api/reanalysis';
import { useBlockSender, useBlockedSenders, useUnblockSender } from '../../api/removal';
import { blockableDomain } from '../../contracts/blockedSender';
import type { Conversation } from '../../contracts/conversation';
import { focusLater } from '../../lib/dialogs';
import { isOfflineError } from '../../lib/offline';
import { ReanalyzeDialog } from '../reanalysis/ReanalyzeDialog';
import { AiIcon } from '../ui/ai-icon';
import type { MenuAction } from '../ui/menu';
import { showToast } from '../ui/toast';
import { DeleteConversationDialog } from './DeleteConversationDialog';

/**
 * What can be done to a conversation besides replying: Reanalyze (the AI reads it again, owner,
 * 19 Nov 2026), block the company's new mail (company mail only), or delete it from NorthList.
 * `dialog` must be in the page; `more` is the button that opened the actions, for giving focus
 * back.
 */
export function useConversationActions(conversation: Conversation) {
  const domain = blockableDomain(conversation.sender);
  const blocked = useBlockedSenders();
  const block = useBlockSender(conversation.key);
  const unblock = useUnblockSender();
  const [deleting, setDeleting] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const reanalyze = useReanalyzeAction(conversation, () => setReanalyzing(true));
  const more = useRef<HTMLButtonElement>(null);
  const existing = domain ? blocked.data?.items.find((row) => row.domain === domain) : undefined;
  // Offline, the offline toast already said that nothing changed.
  const failed = (error: unknown) => {
    if (!isOfflineError(error)) showToast('That did not go through. Try again.');
  };
  const blockAction: MenuAction[] = [];
  if (domain && existing)
    blockAction.push({
      label: `Unblock new mails from ${domain}`,
      disabled: unblock.isPending,
      onSelect: () =>
        unblock.mutate(existing.id, {
          onSuccess: () => showToast(`New mails from ${domain} come in again.`),
          onError: failed,
        }),
    });
  else if (domain)
    blockAction.push({
      label: `Block new mails from ${domain}`,
      disabled: block.isPending || !blocked.data,
      onSelect: () =>
        block.mutate(undefined, {
          onSuccess: (row) =>
            showToast(`New mails from ${domain} are blocked.`, {
              undo: () => unblock.mutate(row.id),
            }),
          onError: failed,
        }),
    });
  const actions: MenuAction[] = [
    ...reanalyze,
    ...blockAction,
    { label: 'Delete from NorthList…', danger: true, onSelect: () => setDeleting(true) },
  ];
  const dialog = (
    <>
      <ReanalyzeDialog
        target={{ kind: 'conversation', key: conversation.key }}
        open={reanalyzing}
        onClose={() => {
          setReanalyzing(false);
          focusLater(more);
        }}
      />
      <DeleteConversationDialog
        conversation={conversation}
        domain={domain}
        open={deleting}
        onClose={() => {
          setDeleting(false);
          focusLater(more);
        }}
      />
    </>
  );
  return { actions, dialog, more };
}

/**
 * "Reanalyze…" for a conversation: not for an archived application's mail (archived is read-only)
 * or while the AI is not set up; off while it runs.
 */
function useReanalyzeAction(conversation: Conversation, open: () => void): MenuAction[] {
  const settings = useAISettings();
  const running = useReanalyzing({ kind: 'conversation', key: conversation.key });
  if (conversation.application?.archived || settings.data?.access.state === 'NOT_SET_UP') return [];
  return [
    {
      label: running ? 'Reanalyzing…' : 'Reanalyze…',
      disabled: running,
      icon: <AiIcon size={18} aria-hidden="true" className="shrink-0" />,
      onSelect: open,
    },
  ];
}
