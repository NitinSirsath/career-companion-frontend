import type { JSONContent } from '@tiptap/core';
import type {
  DraftBlock,
  DraftDoc,
  DraftInline,
  DraftMark,
  DraftParagraph,
} from '../contracts/conversation';

/**
 * The rich text reply (owner, 25 Oct 2026) as the server takes it: the editor's content cut down
 * to the contract's structure, the same one an AI draft comes in. The server checks it again and
 * writes the mail's plain text and HTML itself.
 */

type ListItem = { type: 'listItem'; content: DraftParagraph[] };

const MARKS = new Set(['bold', 'italic', 'underline']);

/** A link address the reply keeps: https://, http:// or mailto: only. */
export const SAFE_LINK = /^(https?:\/\/[^\s]+|mailto:[^\s]+)$/i;

function marksOf(node: JSONContent): DraftMark[] {
  const marks: DraftMark[] = [];
  for (const mark of node.marks ?? []) {
    if (marks.some((other) => other.type === mark.type)) continue;
    if (MARKS.has(mark.type)) marks.push({ type: mark.type as DraftMark['type'] });
    const href = mark.type === 'link' ? mark.attrs?.href : undefined;
    if (typeof href === 'string' && SAFE_LINK.test(href))
      marks.push({ type: 'link', attrs: { href } });
  }
  return marks;
}

function inlineOf(nodes: JSONContent[] = []): DraftInline[] {
  return nodes.flatMap((node): DraftInline[] => {
    if (node.type === 'hardBreak') return [{ type: 'hardBreak' }];
    if (node.type !== 'text' || !node.text) return [];
    const marks = marksOf(node);
    return [
      marks.length ? { type: 'text', text: node.text, marks } : { type: 'text', text: node.text },
    ];
  });
}

const paragraphOf = (node: JSONContent): DraftParagraph => {
  const content = inlineOf(node.content);
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
};

/** A list's items, one level: an item of a list inside an item becomes an item of its own. */
function itemsOf(list: JSONContent): ListItem[] {
  const items: ListItem[] = [];
  for (const item of list.content ?? []) {
    const paragraphs = (item.content ?? []).filter((node) => node.type === 'paragraph');
    if (paragraphs.length) items.push({ type: 'listItem', content: paragraphs.map(paragraphOf) });
    for (const inner of item.content ?? [])
      if (inner.type === 'bulletList' || inner.type === 'orderedList')
        items.push(...itemsOf(inner));
  }
  return items;
}

function blockOf(node: JSONContent): DraftBlock[] {
  if (node.type === 'bulletList') return [{ type: 'bulletList', content: itemsOf(node) }];
  if (node.type === 'orderedList') {
    const start = Number(node.attrs?.start ?? 1);
    return [
      {
        type: 'orderedList',
        ...(Number.isInteger(start) && start > 1 ? { attrs: { start } } : {}),
        content: itemsOf(node),
      },
    ];
  }
  if (node.type === 'paragraph') return [paragraphOf(node)];
  // Nothing else is turned on in the editor; anything else keeps only its words.
  return (node.content ?? []).flatMap((child) =>
    child.type === 'text' || child.type === 'hardBreak' ? [paragraphOf(node)] : blockOf(child),
  );
}

/** The editor's content (`editor.getJSON()`) as the reply's structure. */
export function toReplyDoc(json: JSONContent): DraftDoc {
  return {
    type: 'doc',
    content: (json.content ?? [])
      .flatMap(blockOf)
      .filter((block) => block.type === 'paragraph' || block.content.length > 0),
  };
}

const paragraphsOf = (block: DraftBlock): DraftParagraph[] =>
  block.type === 'paragraph' ? [block] : block.content.flatMap((item) => item.content);

/** The reply's words on one line, for a short preview ("Draft to Priya: Hi Priya, …"). */
export const docWords = (doc: DraftDoc): string =>
  doc.content
    .flatMap(paragraphsOf)
    .map((paragraph) =>
      (paragraph.content ?? []).map((node) => (node.type === 'text' ? node.text : ' ')).join(''),
    )
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

/** True when the reply holds no words at all. */
export const isEmptyDoc = (doc: DraftDoc): boolean =>
  !doc.content
    .flatMap(paragraphsOf)
    .some((paragraph) =>
      paragraph.content?.some((node) => node.type === 'text' && node.text.trim()),
    );

/**
 * A typed address as a link the reply keeps: "nitin.dev" becomes https://nitin.dev and an email
 * address becomes mailto:. Null when it cannot be one.
 */
export function linkAddress(typed: string): string | null {
  const value = typed.trim();
  if (!value || /\s/.test(value)) return null;
  if (SAFE_LINK.test(value)) return value;
  if (/^[^@/:]+@[^@/:]+\.[a-z]{2,}$/i.test(value)) return `mailto:${value}`;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/\S*)?$/i.test(value)) return `https://${value}`;
  return null;
}

// ─── Markdown pasted into the reply ─────────────────────────────────────────

const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,3})[.)]\s+(.*)$/;

/** True when pasted plain text is written in Markdown the reply can show as formatting. */
export const looksLikeMarkdown = (text: string): boolean =>
  /(^|\n)\s*([-*+]|\d{1,3}[.)])\s+\S/.test(text) ||
  /\*\*\S[^*]*\*\*/.test(text) ||
  /\[[^\]]+\]\((https?:|mailto:)[^)\s]+\)/.test(text);

function push(out: DraftInline[], text: string, marks: DraftMark[]) {
  if (text) out.push(marks.length ? { type: 'text', text, marks } : { type: 'text', text });
}

/** Bold (`**`), italic (`_` or `*`) and links; anything else stays text. */
function markdownInline(text: string, marks: DraftMark[] = [], out: DraftInline[] = []) {
  let rest = text;
  while (rest) {
    const link = rest.match(/^\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/);
    const bold = rest.match(/^\*\*(?=\S)([\s\S]*?\S)\*\*/);
    const italic = rest.match(/^(?:_(?=\S)([\s\S]*?\S)_(?![a-z0-9])|\*(?=\S)([^*]*?\S)\*)/i);
    if (link) {
      const kept = SAFE_LINK.test(link[2])
        ? [...marks, { type: 'link' as const, attrs: { href: link[2] } }]
        : marks;
      markdownInline(link[1], kept, out);
      rest = rest.slice(link[0].length);
    } else if (bold) {
      markdownInline(bold[1], [...marks, { type: 'bold' }], out);
      rest = rest.slice(bold[0].length);
    } else if (italic) {
      markdownInline(italic[1] ?? italic[2], [...marks, { type: 'italic' }], out);
      rest = rest.slice(italic[0].length);
    } else {
      const next = rest.slice(1).search(/[[*_]/);
      const take = next === -1 ? rest.length : next + 1;
      push(out, rest.slice(0, take), marks);
      rest = rest.slice(take);
    }
  }
  return out;
}

function markdownParagraph(lines: string[]): DraftParagraph {
  const content: DraftInline[] = [];
  lines.forEach((line, index) => {
    if (index) content.push({ type: 'hardBreak' });
    markdownInline(line.trim(), [], content);
  });
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
}

/** Adds a Markdown list line ("- item", "3. item") to the list before it, or starts a list. */
function addListLine(
  content: DraftBlock[],
  bullet: RegExpMatchArray | null,
  numbered: RegExpMatchArray | null,
) {
  const kind = bullet ? 'bulletList' : 'orderedList';
  const words = bullet?.[1] ?? numbered?.[2] ?? '';
  const item: ListItem = { type: 'listItem', content: [markdownParagraph([words])] };
  const last = content[content.length - 1];
  if (last?.type === kind) last.content.push(item);
  else if (kind === 'bulletList') content.push({ type: 'bulletList', content: [item] });
  else {
    const start = Number(numbered?.[1] ?? 1);
    content.push({
      type: 'orderedList',
      ...(start > 1 ? { attrs: { start } } : {}),
      content: [item],
    });
  }
}

/** Pasted Markdown as the reply's structure: paragraphs, lists, bold, italic and links. */
export function markdownToDoc(markdown: string): DraftDoc {
  const content: DraftBlock[] = [];
  let lines: string[] = [];
  const flush = () => {
    if (lines.length) content.push(markdownParagraph(lines));
    lines = [];
  };
  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const bullet = line.match(BULLET);
    const numbered = line.match(NUMBERED);
    if (bullet || numbered) {
      flush();
      addListLine(content, bullet, numbered);
    } else if (line.trim()) lines.push(line);
    else flush();
  }
  flush();
  return { type: 'doc', content };
}
