import { Fragment, type ReactNode } from 'react';
import type { DraftDoc, DraftInline, DraftParagraph } from '../../contracts/conversation';

/** Text with its marks, as React elements: nothing in it can become markup of its own. */
function inline(nodes: DraftInline[] = []): ReactNode[] {
  return nodes.map((node, index) => {
    if (node.type === 'hardBreak') return <br key={index} />;
    let out: ReactNode = node.text;
    if (node.marks?.some((mark) => mark.type === 'underline')) out = <u>{out}</u>;
    if (node.marks?.some((mark) => mark.type === 'italic')) out = <em>{out}</em>;
    if (node.marks?.some((mark) => mark.type === 'bold')) out = <strong>{out}</strong>;
    const href = node.marks?.find((mark) => mark.type === 'link')?.attrs?.href;
    if (href)
      out = (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {out}
        </a>
      );
    return <Fragment key={index}>{out}</Fragment>;
  });
}

const paragraph = (block: DraftParagraph, key: number) => (
  <p key={key}>{block.content?.length ? inline(block.content) : <br />}</p>
);

/** A reply's structure shown as it will look in the mail: the reply on its way. */
export function ReplyDocView({ doc }: { doc: DraftDoc }) {
  return (
    <div className="reply-text max-w-[75ch] text-sm">
      {doc.content.map((block, key) => {
        if (block.type === 'paragraph') return paragraph(block, key);
        const items = block.content.map((item, index) => (
          <li key={index}>{item.content.map(paragraph)}</li>
        ));
        return block.type === 'bulletList' ? (
          <ul key={key}>{items}</ul>
        ) : (
          <ol key={key} start={block.attrs?.start}>
            {items}
          </ol>
        );
      })}
    </div>
  );
}
