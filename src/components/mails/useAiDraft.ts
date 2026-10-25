import { useRef, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { ReplyDraftResponse } from '../../contracts/conversation';
import { showToast } from '../ui/toast';

/**
 * Puts an AI draft into the reply text. "Stop" lets the user type instead: a draft that arrives
 * after it is dropped. A draft that replaces text the user wrote can be undone from its toast.
 */
export function useAiDraft(form: UseFormReturn<{ text: string }>) {
  const text = {
    get: () => form.getValues('text'),
    set: (value: string) => form.setValue('text', value, { shouldDirty: true }),
  };
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
    text.set(draft.text);
    setWrittenBy(draft.model);
    if (before.trim()) showToast('Draft written', { undo: () => text.set(before) });
  };
  return { writing, setWriting, onDraft, writtenBy, stop: () => setWriting(false) };
}
