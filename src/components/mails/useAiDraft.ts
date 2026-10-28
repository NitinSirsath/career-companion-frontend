import { useRef, useState } from 'react';
import type { DraftDoc, ReplyDraftResponse } from '../../contracts/conversation';
import { isEmptyDoc } from '../../lib/replyDoc';
import { showToast } from '../ui/toast';

/** Where a draft goes: the reply text, read and replaced as a whole. */
export interface DraftTarget {
  get: () => DraftDoc | null;
  set: (doc: DraftDoc | null) => void;
}

/**
 * Puts an AI draft into the reply text, with its formatting (owner, 25 Oct 2026). "Stop" lets the
 * user type instead: a draft that arrives after it is dropped. A draft that replaces text the user
 * wrote can be undone from its toast.
 */
export function useAiDraft(text: DraftTarget) {
  const [writing, setWritingState] = useState(false);
  const [writtenBy, setWrittenBy] = useState<string | null>(null);
  const live = useRef(false);
  const setWriting = (value: boolean) => {
    live.current = value;
    setWritingState(value);
  };
  const onDraft = (draft: ReplyDraftResponse) => {
    if (!live.current) return;
    const before = text.get();
    text.set(draft.doc);
    setWrittenBy(draft.model);
    if (before && !isEmptyDoc(before)) showToast('Draft written', { undo: () => text.set(before) });
  };
  return { writing, setWriting, onDraft, writtenBy, stop: () => setWriting(false) };
}
