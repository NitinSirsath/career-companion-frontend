import { useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import {
  Edit,
  Launch,
  Link as LinkIcon,
  ListBulleted,
  ListNumbered,
  TextBold,
  TextItalic,
  TextUnderline,
  Unlink,
} from '@carbon/icons-react';
import type { Editor } from '@tiptap/core';
import { EditorContent, useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import type { DraftDoc } from '../../contracts/conversation';
import { linkAddress, toReplyDoc } from '../../lib/replyDoc';
import { cn } from '../../lib/utils';
import { TooltipContent } from '../ui/tooltip';
import { PhoneReplySlots } from './phoneReplySlots';
import { useReplyEditor } from './useReplyEditor';

/**
 * The rich text reply box (owner, 25 Oct 2026), in the calm look of Linear and Notion: the text
 * sits on the reply card; on a laptop a small bar floats over selected words; quiet format icons
 * stay at the bottom beside Send; typing `**word**`, `_word_`, "- " or "1. " formats as you go.
 * On a phone there is no floating bar (it would fight the phone's own copy and paste menu): the
 * format row sits above the keyboard. Loaded only when the reply box opens.
 */

/** What the reply box can do with the text. */
export interface ReplyEditorHandle {
  /** The reply as the server takes it. */
  getDoc: () => DraftDoc;
  /** The reply's words, for the length check. */
  getText: () => string;
  /** Puts a reply in, or empties the box with null. Undo (⌘Z) brings the earlier text back. */
  setDoc: (doc: DraftDoc | null) => void;
  focus: () => void;
}

const MAC = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform);
const key = (mac: string, other: string) => (MAC ? mac : other);

type Format = 'bold' | 'italic' | 'underline' | 'bulletList' | 'orderedList' | 'link';
const FORMATS: { format: Format; label: string; keys: string; Icon: typeof TextBold }[] = [
  { format: 'bold', label: 'Bold', keys: key('⌘B', 'Ctrl+B'), Icon: TextBold },
  { format: 'italic', label: 'Italic', keys: key('⌘I', 'Ctrl+I'), Icon: TextItalic },
  { format: 'underline', label: 'Underline', keys: key('⌘U', 'Ctrl+U'), Icon: TextUnderline },
  { format: 'bulletList', label: 'Bulleted list', keys: '- then space', Icon: ListBulleted },
  { format: 'orderedList', label: 'Numbered list', keys: '1. then space', Icon: ListNumbered },
  { format: 'link', label: 'Link', keys: key('⌘K', 'Ctrl+K'), Icon: LinkIcon },
];

function toggle(editor: Editor, format: Format) {
  const chain = editor.chain().focus();
  if (format === 'bold') chain.toggleBold().run();
  if (format === 'italic') chain.toggleItalic().run();
  if (format === 'underline') chain.toggleUnderline().run();
  if (format === 'bulletList') chain.toggleBulletList().run();
  if (format === 'orderedList') chain.toggleOrderedList().run();
}

/** A format button with its name and shortcut on hover. */
function FormatButton({
  label,
  keys,
  active,
  large,
  onPress,
  children,
}: {
  label: string;
  keys: string;
  active: boolean;
  large: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger
        type="button"
        aria-label={label}
        aria-pressed={active}
        // Keeps the selection: the editor does not lose focus to the button.
        onMouseDown={(event) => event.preventDefault()}
        onClick={onPress}
        className={cn(
          'inline-flex shrink-0 cursor-pointer items-center justify-center text-text-secondary transition-colors duration-70 ease-standard hover:bg-layer-hover hover:text-text-primary',
          large ? 'size-10' : 'size-7',
          active && 'bg-surface-selected text-text-primary',
        )}
      >
        {children}
      </BaseTooltip.Trigger>
      <TooltipContent>
        {label}
        <span className="ml-1.5 font-mono opacity-75">{keys}</span>
      </TooltipContent>
    </BaseTooltip.Root>
  );
}

/** The six format buttons, with a thin line between the groups. */
function FormatButtons({
  editor,
  large,
  onLink,
}: {
  editor: Editor;
  large: boolean;
  onLink: () => void;
}) {
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      Object.fromEntries(FORMATS.map(({ format }) => [format, current.isActive(format)])) as Record<
        Format,
        boolean
      >,
  });
  return FORMATS.map(({ format, label, keys, Icon }, index) => (
    <span key={format} className="flex items-center">
      {(index === 3 || index === 5) && (
        <span aria-hidden="true" className="mx-1 h-4 w-px bg-border-subtle" />
      )}
      <FormatButton
        label={label}
        keys={keys}
        active={active[format]}
        large={large}
        onPress={() => (format === 'link' ? onLink() : toggle(editor, format))}
      >
        <Icon size={16} aria-hidden="true" />
      </FormatButton>
    </span>
  ));
}

/** ⌘K: one field for the address. Enter puts it on the words; Escape goes back to the text. */
function LinkField({
  editor,
  initial,
  onDone,
  className,
}: {
  editor: Editor;
  initial: string;
  onDone: () => void;
  className?: string;
}) {
  const [value, setValue] = useState(initial);
  const [wrong, setWrong] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  // The field opens because the user asked for it: they type the address now. The floating bar
  // shows a moment after the field is made, so focus waits for it.
  useEffect(() => {
    const frame = requestAnimationFrame(() => field.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  const apply = () => {
    const href = linkAddress(value);
    if (!href) {
      setWrong(true);
      return;
    }
    const { empty } = editor.state.selection;
    const onLink = editor.isActive('link');
    if (empty && !onLink)
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: value.trim(),
          marks: [{ type: 'link', attrs: { href } }],
        })
        .run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    onDone();
  };
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex h-10 items-center gap-2 border border-border-subtle bg-surface-raised px-2.5 shadow-popup">
        <LinkIcon size={16} aria-hidden="true" className="shrink-0 text-text-secondary" />
        <input
          ref={field}
          aria-label="Link address"
          placeholder="Paste or type a link"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setWrong(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              apply();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              editor.commands.focus();
              onDone();
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-text-tertiary"
        />
        <kbd className="border border-border-default px-1 font-mono text-xs text-text-secondary">
          ↵
        </kbd>
      </div>
      {wrong && (
        <p role="alert" className="text-xs text-danger-text">
          Use a web or mail address, like nitin.dev or name@example.com.
        </p>
      )}
    </div>
  );
}

/** With the cursor on a link: where it goes, and edit, remove and open. */
function LinkCard({ editor, onEdit }: { editor: Editor; onEdit: () => void }) {
  const href = useEditorState({
    editor,
    selector: ({ editor: current }) => current.getAttributes('link').href as string | undefined,
  });
  const icon =
    'inline-flex size-7 cursor-pointer items-center justify-center text-text-secondary hover:bg-layer-hover hover:text-text-primary';
  return (
    <div className="flex max-w-[360px] items-center gap-1 border border-border-subtle bg-surface-raised py-1 pr-1 pl-2.5 text-[13px] shadow-popup">
      <span className="min-w-0 truncate text-link">
        {href?.replace(/^(https?:\/\/|mailto:)/, '')}
      </span>
      <button
        type="button"
        aria-label="Edit link"
        className={icon}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onEdit}
      >
        <Edit size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Remove link"
        className={icon}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}
      >
        <Unlink size={14} aria-hidden="true" />
      </button>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open link in a new tab"
        className={icon}
      >
        <Launch size={14} aria-hidden="true" />
      </a>
    </div>
  );
}

interface RichReplyFieldProps {
  /** The text the box starts with: kept unsent text, or null. */
  initial: DraftDoc | null;
  /** Each change, for the kept text. */
  onChange: (doc: DraftDoc) => void;
  /** ⌘Enter or Ctrl+Enter sends. */
  onSubmitKey: () => void;
  /** The box is ready: what the reply form can do with it. */
  onReady: (handle: ReplyEditorHandle) => void;
  phone: boolean;
  invalid: boolean;
  /** The id of the line that says what is wrong, when something is. */
  describedBy?: string;
  /** Under the text, above the format row: the kept-text line and what is wrong. */
  children?: ReactNode;
  /** The right end of the format row: Send and the other way to answer. Not on a phone. */
  actions?: ReactNode;
}

/** Hands the reply form what it can do with the text, from the live editor each time. */
function useEditorHandle(
  editor: Editor,
  current: RefObject<Editor | null>,
  onReady: (handle: ReplyEditorHandle) => void,
) {
  useEffect(() => {
    // The box may make a new editor (a fast refresh while developing): use the live one.
    const live = () => current.current ?? editor;
    onReady({
      getDoc: () => toReplyDoc(live().getJSON()),
      getText: () => live().getText(),
      setDoc: (doc) => {
        live()
          .chain()
          .focus()
          .setContent(doc ?? '', { emitUpdate: true })
          .run();
      },
      focus: () => live().commands.focus('end'),
    });
  }, [editor, current, onReady]);
}

/** Tells screen readers whether the reply has a problem, and where it is said. */
function useInvalidState(editor: Editor, invalid: boolean, describedBy: string | undefined) {
  useEffect(() => {
    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        attributes: {
          ...(editor.options.editorProps.attributes as Record<string, string>),
          'aria-invalid': String(invalid),
          ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        },
      },
    });
  }, [editor, invalid, describedBy]);
}

interface LinkState {
  /** The address the field starts with: the link's own when the cursor is on one. */
  linking: { initial: string } | null;
  open: () => void;
  close: () => void;
}

/** On a laptop: the bar over selected words (or the link field), and the card on a link. */
function FloatingMenus({ editor, link }: { editor: Editor; link: LinkState }) {
  const { linking } = link;
  // The floating bar does not ask again whether to show when only this state changes: tell it.
  useEffect(() => {
    const { state, view } = editor;
    if (linking) view.dispatch(state.tr.setMeta('bubbleMenu', 'show'));
    else if (state.selection.empty) view.dispatch(state.tr.setMeta('bubbleMenu', 'hide'));
  }, [editor, linking]);
  return (
    <>
      <BubbleMenu
        editor={editor}
        options={{ placement: 'top-start', offset: 8 }}
        shouldShow={({ editor: shown, state }) =>
          !!linking || (!state.selection.empty && shown.isFocused)
        }
        className="z-40"
      >
        {linking ? (
          <LinkField
            editor={editor}
            initial={linking.initial}
            onDone={link.close}
            className="w-80"
          />
        ) : (
          <div
            role="toolbar"
            aria-label="Format the selected words"
            className="flex items-center gap-0.5 border border-border-subtle bg-surface-raised p-1 shadow-popup"
          >
            <FormatButtons editor={editor} large={false} onLink={link.open} />
          </div>
        )}
      </BubbleMenu>
      <LinkCardMenu editor={editor} link={link} />
    </>
  );
}

/** With the cursor on a link: the small card under it. */
function LinkCardMenu({ editor, link }: { editor: Editor; link: LinkState }) {
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="linkCard"
      options={{ placement: 'bottom-start', offset: 6 }}
      shouldShow={({ editor: shown, state }) =>
        !link.linking && state.selection.empty && shown.isActive('link')
      }
      className="z-40"
    >
      <LinkCard editor={editor} onEdit={link.open} />
    </BubbleMenu>
  );
}

/** The quiet format icons beside Send; on a phone, the row above the keyboard. */
function FormatRow({
  editor,
  link,
  phone,
  actions,
}: {
  editor: Editor;
  link: LinkState;
  phone: boolean;
  actions?: ReactNode;
}) {
  return (
    <>
      {phone && link.linking && (
        <LinkField
          editor={editor}
          initial={link.linking.initial}
          onDone={link.close}
          className="px-4 pt-2"
        />
      )}
      <div
        className={cn('flex items-center gap-3', phone ? 'px-2 py-1' : 'flex-wrap py-2 pr-2 pl-3')}
      >
        <div role="toolbar" aria-label="Format" className="flex items-center gap-0.5">
          <FormatButtons editor={editor} large={phone} onLink={link.open} />
        </div>
        {actions && <div className="ml-auto flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </>
  );
}

export default function RichReplyField({
  initial,
  onChange,
  onSubmitKey,
  onReady,
  phone,
  invalid,
  describedBy,
  children,
  actions,
}: RichReplyFieldProps) {
  const [linking, setLinking] = useState<{ initial: string } | null>(null);
  const formatSlot = useContext(PhoneReplySlots)?.format ?? null;
  const { editor, current } = useReplyEditor({
    initial,
    onChange,
    onSubmitKey,
    onLinkKey: () => link.open(),
  });
  useEditorHandle(editor, current, onReady);
  useInvalidState(editor, invalid, describedBy);
  const link: LinkState = {
    linking,
    open: () =>
      setLinking({ initial: (editor.getAttributes('link').href as string | undefined) ?? '' }),
    close: () => setLinking(null),
  };
  const row = <FormatRow editor={editor} link={link} phone={phone} actions={actions} />;
  return (
    <div className="flex flex-col">
      <EditorContent editor={editor} />
      {!phone && <FloatingMenus editor={editor} link={link} />}
      {phone && <LinkCardMenu editor={editor} link={link} />}
      {children}
      {phone && formatSlot ? createPortal(row, formatSlot) : row}
    </div>
  );
}
