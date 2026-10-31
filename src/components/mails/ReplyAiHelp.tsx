import { useId, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useWriteReplyDraft } from '../../api/conversations';
import type { ReplyDraftResponse } from '../../contracts/conversation';
import { draftProblem, type DraftProblem } from '../../lib/replyDraft';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { InlineNotification } from '../ui/notification';
import { isOfflineError } from '../../lib/offline';

/** What the reply box needs to offer AI help: the conversation and its newest mail's choices. */
export interface ReplyAi {
  conversationKey: string;
  /** Up to three short replies from the newest mail's AI read; empty when none. */
  choices: string[];
  /** The model that reads this conversation, in words, for "Writing…"; null when unknown. */
  model: string | null;
}

/** While the AI writes: the box is locked and says so, in the app's grey AI look. */
export function WritingDraft({ model, onStop }: { model: string | null; onStop: () => void }) {
  return (
    <div
      role="status"
      className="flex min-h-32 items-start justify-between gap-3 border border-border-default bg-layer-hover px-4 py-3 text-sm"
    >
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="text-text-secondary">{model ?? 'AI'} ·</span>
        <span className="ai-shimmer">Writing your reply from the whole conversation</span>
      </span>
      <Button type="button" size="sm" variant="secondary" onClick={onStop}>
        Stop
      </Button>
    </div>
  );
}

/** Why the last "Write with AI" did not work, and where to fix it. */
function ProblemLine({ problem }: { problem: DraftProblem }) {
  return (
    <InlineNotification kind="warning">
      {problem.text}{' '}
      {problem.link && (
        <Link to="/ai" className="text-link">
          {problem.link}
        </Link>
      )}
    </InlineNotification>
  );
}

/** The optional one-line hint and "Write with AI". Enter in the hint writes too. */
function HintRow({
  hint,
  onHint,
  writing,
  onWrite,
}: {
  hint: string;
  onHint: (hint: string) => void;
  writing: boolean;
  onWrite: () => void;
}) {
  const hintId = useId();
  return (
    <div className="flex gap-2 max-md:flex-col">
      <Label htmlFor={hintId} className="sr-only">
        What the AI should say (optional)
      </Label>
      <Input
        id={hintId}
        value={hint}
        maxLength={200}
        disabled={writing}
        placeholder={`Optional: what to say, like "I'm free Tue after 3"`}
        className="h-8 min-w-0 flex-1 text-sm"
        onChange={(event) => onHint(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          onWrite();
        }}
      />
      <Button type="button" size="sm" variant="secondary" disabled={writing} onClick={onWrite}>
        Write with AI
      </Button>
    </div>
  );
}

/**
 * "Reply with AI" above the reply text (owner, 24 Oct 2026): the newest mail's reply choices, and
 * "Write with AI" with an optional one-line hint. One AI call per click; the draft goes into the
 * box for the user to edit and send, and nothing is sent by itself. With no AI set up, one line
 * says where to choose it.
 */
export function ReplyAiHelp({
  ai,
  writing,
  onWriting,
  onDraft,
}: {
  ai: ReplyAi;
  writing: boolean;
  onWriting: (writing: boolean) => void;
  onDraft: (draft: ReplyDraftResponse) => void;
}) {
  const [hint, setHint] = useState('');
  const write = useWriteReplyDraft(ai.conversationKey);
  const settings = useQuery({
    queryKey: ['aiSettings'],
    queryFn: ({ signal }) => api.getAISettings({ signal }),
  });
  if (settings.data?.access.state === 'NOT_SET_UP')
    return (
      <p className="text-xs text-text-secondary">
        Set up AI to get reply choices and drafts.{' '}
        <Link to="/ai" className="text-link">
          Choose how mails are read
        </Link>
      </p>
    );
  const ask = (body: { choice?: string; hint?: string }) => {
    onWriting(true);
    write.mutate(body, {
      onSuccess: (draft) => onDraft(draft),
      onSettled: () => onWriting(false),
    });
  };
  // Offline the toast says that nothing was written.
  const problem =
    write.isError && !writing && !isOfflineError(write.error) ? draftProblem(write.error) : null;
  const withHint = (body: { choice?: string }) => ({
    ...body,
    ...(hint.trim() ? { hint: hint.trim() } : {}),
  });
  return (
    <div className="flex flex-col gap-2" aria-label="Reply with AI" role="group">
      {problem && <ProblemLine problem={problem} />}
      <span className="text-xs text-text-secondary">
        {ai.choices.length ? 'Reply with AI' : 'Let the AI write it'}
      </span>
      {ai.choices.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ai.choices.map((choice) => (
            <Button
              key={choice}
              type="button"
              size="sm"
              variant="secondary"
              disabled={writing}
              onClick={() => ask(withHint({ choice }))}
            >
              {choice}
            </Button>
          ))}
        </div>
      )}
      <HintRow hint={hint} onHint={setHint} writing={writing} onWrite={() => ask(withHint({}))} />
    </div>
  );
}
