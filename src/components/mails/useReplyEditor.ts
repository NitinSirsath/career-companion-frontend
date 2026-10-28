import { useLayoutEffect, useRef } from 'react';
import { Extension, type Editor } from '@tiptap/core';
import { Bold } from '@tiptap/extension-bold';
import { Document } from '@tiptap/extension-document';
import { HardBreak } from '@tiptap/extension-hard-break';
import { Italic } from '@tiptap/extension-italic';
import { Link } from '@tiptap/extension-link';
import { BulletList, ListItem, ListKeymap, OrderedList } from '@tiptap/extension-list';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { Underline } from '@tiptap/extension-underline';
import { Placeholder, UndoRedo } from '@tiptap/extensions';
import { useEditor } from '@tiptap/react';
import type { DraftDoc } from '../../contracts/conversation';
import { SAFE_LINK, looksLikeMarkdown, markdownToDoc, toReplyDoc } from '../../lib/replyDoc';

interface ReplyEditorOptions {
  /** The text the box starts with, or null. */
  initial: DraftDoc | null;
  onChange: (doc: DraftDoc) => void;
  /** ⌘Enter or Ctrl+Enter. */
  onSubmitKey: () => void;
  /** ⌘K or Ctrl+K. */
  onLinkKey: () => void;
}

/**
 * The reply's editor (Tiptap): only the formats the owner agreed (bold, italic, underline, bullet
 * and numbered lists, links, line breaks, undo), with typing shortcuts such as `**word**` and
 * "- ". A link must be https, http or mailto. Pasted text keeps only these formats; pasted
 * Markdown turns into them.
 */
export function useReplyEditor({ initial, onChange, onSubmitKey, onLinkKey }: ReplyEditorOptions) {
  // The newest callbacks, for the editor's own handlers, which are made once.
  const latest = useRef({ onChange, onSubmitKey, onLinkKey });
  const current = useRef<Editor | null>(null);
  const editor = useEditor({
    immediatelyRender: true,
    autofocus: 'end',
    extensions: [
      Document,
      Paragraph,
      Text,
      HardBreak,
      Bold,
      Italic,
      Underline,
      BulletList,
      OrderedList,
      ListItem,
      ListKeymap,
      UndoRedo,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: 'https',
        protocols: ['mailto'],
        // An address typed without "https://" ("nitin.dev") is checked as an https one.
        isAllowedUri: (url) =>
          SAFE_LINK.test(/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`),
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Placeholder.configure({ placeholder: 'Write your reply' }),
      Extension.create({
        name: 'replyKeys',
        addKeyboardShortcuts: () => ({
          'Mod-Enter': () => {
            latest.current.onSubmitKey();
            return true;
          },
          'Mod-k': () => {
            latest.current.onLinkKey();
            return true;
          },
          // One level of lists only: Tab does not move an item into another list.
          Tab: () => true,
          'Shift-Tab': () => true,
        }),
      }),
    ],
    content: initial ?? undefined,
    editorProps: {
      attributes: {
        class:
          'reply-text min-h-28 px-4 pt-3 pb-2 text-sm outline-none md:max-h-[45vh] md:overflow-y-auto',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Your reply',
      },
      // A pasted table keeps its rows as lines; its cells stay apart by a space.
      transformPastedHTML: (html) => html.replace(/<\/(td|th)>/gi, ' </$1>'),
      // Markdown pasted as plain text (no HTML with it) turns into formatting.
      handlePaste: (_view, event) => {
        const plain = event.clipboardData?.getData('text/plain') ?? '';
        if (event.clipboardData?.getData('text/html') || !looksLikeMarkdown(plain)) return false;
        current.current?.chain().focus().insertContent(markdownToDoc(plain).content).run();
        return true;
      },
    },
    onUpdate: ({ editor: changed }) => latest.current.onChange(toReplyDoc(changed.getJSON())),
  });
  useLayoutEffect(() => {
    latest.current = { onChange, onSubmitKey, onLinkKey };
    current.current = editor;
  });
  return { editor, current };
}
