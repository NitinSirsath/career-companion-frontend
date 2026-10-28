import { afterEach } from 'vitest';
import { act, screen } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import type { DraftDoc } from '../contracts/conversation';

// jsdom lays nothing out, but the editor asks where the cursor is when it scrolls to it.
if (typeof Range !== 'undefined' && !Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
}

// Unsent reply text is kept in the browser: each test starts with none.
afterEach(() => localStorage.clear());

/** Where to look for the reply box: the page, or one form of it. */
type Scope = Pick<typeof screen, 'findByRole'>;

/** A plain reply's structure, as the reply box sends it: an empty line starts a paragraph. */
export const replyDoc = (text: string): DraftDoc => ({
  type: 'doc',
  content: text.split('\n\n').map((words) => ({
    type: 'paragraph',
    content: [{ type: 'text', text: words }],
  })),
});

/** The rich text reply box, once its editor has loaded. */
export const replyBox = (scope: Scope = screen) =>
  scope.findByRole('textbox', { name: 'Your reply' });

/** The reply box's editor: tests set its text the way typing would. */
export async function replyEditor(scope: Scope = screen): Promise<Editor> {
  return ((await replyBox(scope)) as HTMLElement & { editor: Editor }).editor;
}

/** Writes a reply into the box, as the user would type it. */
export async function writeReply(scope: Scope, text: string) {
  const editor = await replyEditor(scope);
  act(() => {
    editor.commands.setContent(replyDoc(text), { emitUpdate: true });
  });
}

/** The words in the reply box now. */
export const replyWords = async (scope: Scope = screen) =>
  (await replyEditor(scope)).getText({ blockSeparator: '\n\n' });
