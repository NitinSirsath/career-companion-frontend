import { useEffect, useEffectEvent, useId, useRef, useState, type RefObject } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useWriteReplyDraft } from '../../api/conversations';
import type { ReplyDraftResponse } from '../../contracts/conversation';
import { draftProblem, type DraftProblem } from '../../lib/replyDraft';
import { useIsPhone } from '../layout/useIsPhone';
import { AiIcon } from '../ui/ai-icon';
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
  /**
   * Set when the reply opens from the phone's "AI reply" sheet (owner, 12 Nov 2026): write at once
   * from this choice, or with no choice put the cursor in the hint. `onStarted` clears it.
   */
  start?: { choice: string | null } | null;
  onStarted?: () => void;
}

/** While the AI writes: the box is locked and says so, in the app's grey AI look. */
export function WritingDraft({ model, onStop }: { model: string | null; onStop: () => void }) {
  return (
    <div
      role="status"
      className="flex min-h-32 items-start justify-between gap-3 rounded-lg border border-border-default bg-layer-hover px-4 py-3 text-sm"
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
  field,
}: {
  hint: string;
  onHint: (hint: string) => void;
  writing: boolean;
  onWrite: () => void;
  field: RefObject<HTMLInputElement | null>;
}) {
  const hintId = useId();
  const phone = useIsPhone();
  return (
    <div className="flex gap-2">
      <Label htmlFor={hintId} className="sr-only">
        What the AI should say (optional)
      </Label>
      <Input
        ref={field}
        id={hintId}
        value={hint}
        maxLength={200}
        disabled={writing}
        placeholder={
          phone ? 'Optional: what to say' : `Optional: what to say, like "I'm free Tue after 3"`
        }
        className="h-8 min-w-0 flex-1 text-sm max-md:h-10 max-md:bg-surface-raised max-md:text-base"
        onChange={(event) => onHint(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          onWrite();
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={writing}
        onClick={onWrite}
        className="max-md:h-10 max-md:border-transparent max-md:bg-action-primary max-md:px-4 max-md:text-[15px] max-md:text-text-inverse"
      >
        Write with AI
      </Button>
    </div>
  );
}

/**
 * Opened from the phone's "AI reply" sheet: runs `begin` once with the chosen reply (or none, to
 * ask for a hint), then clears the start.
 */
function useAiStart(ai: ReplyAi, begin: (choice: string | null) => void) {
  const run = useEffectEvent((choice: string | null) => {
    ai.onStarted?.();
    begin(choice);
  });
  const start = ai.start;
  useEffect(() => {
    if (start) run(start.choice);
  }, [start]);
}

/** The newest mail's reply choices, one button each. */
function ChoiceButtons({
  choices,
  writing,
  onPick,
}: {
  choices: string[];
  writing: boolean;
  onPick: (choice: string) => void;
}) {
  if (!choices.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {choices.map((choice) => (
        <Button
          key={choice}
          type="button"
          size="sm"
          variant="secondary"
          disabled={writing}
          onClick={() => onPick(choice)}
          className="max-md:h-auto max-md:min-h-9 max-md:border-transparent max-md:bg-surface-raised max-md:py-2 max-md:text-left max-md:text-[15px] max-md:whitespace-normal"
        >
          {choice}
        </Button>
      ))
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
  const field = useRef<HTMLInputElement>(null);
  const write = useWriteReplyDraft(ai.conversationKey);
  const settings = useQuery({
    queryKey: ['aiSettings'],
    queryFn: ({ signal }) => api.getAISettings({ signal }),
  });
  const notSetUp = settings.data?.access.state === 'NOT_SET_UP';
  const ask = (body: { choice?: string; hint?: string }) => {
    onWriting(true);
    write.mutate(body, {
      onSuccess: (draft) => onDraft(draft),
      onSettled: () => onWriting(false),
    });
  };
  useAiStart(ai, (choice) => {
    if (notSetUp) return;
    if (choice) ask({ choice });
    else field.current?.focus();
  });
  if (notSetUp)
    return (
      <p className="text-xs text-text-secondary">
        Set up AI to get reply choices and drafts.{' '}
        <Link to="/ai" className="text-link">
          Choose how mails are read
        </Link>
      </p>
    );
  // Offline the toast says that nothing was written.
  const problem =
    write.isError && !writing && !isOfflineError(write.error) ? draftProblem(write.error) : null;
  const withHint = (body: { choice?: string }) => ({
    ...body,
    ...(hint.trim() ? { hint: hint.trim() } : {}),
  });
  return (
    // Phones: one soft grey box inside the reply sheet (owner, 13 Nov 2026).
    <div
      className="flex flex-col gap-2 max-md:mt-1 max-md:gap-2.5 max-md:rounded-2xl max-md:bg-layer-accent max-md:p-3"
      aria-label="Reply with AI"
      role="group"
    >
      {problem && <ProblemLine problem={problem} />}
      <span className="flex items-center gap-1.5 text-xs text-text-secondary max-md:text-[13px] max-md:font-semibold">
        <AiIcon size={16} aria-hidden="true" className="hidden max-md:block" />
        {ai.choices.length ? 'Reply with AI' : 'Let the AI write it'}
      </span>
      <ChoiceButtons
        choices={ai.choices}
        writing={writing}
        onPick={(choice) => ask(withHint({ choice }))}
      />
      <HintRow
        hint={hint}
        onHint={setHint}
        writing={writing}
        onWrite={() => ask(withHint({}))}
        field={field}
      />
    </div>
  );
}
