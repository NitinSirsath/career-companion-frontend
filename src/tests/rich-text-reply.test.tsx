// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Slice } from '@tiptap/pm/model';
import { ApiError, api } from '../api/client';
import type { ConversationDetail, DraftDoc } from '../contracts/conversation';
import type { z } from 'zod';
import type { MailThreadSchema } from '../contracts/mailbox';
import { dropAllKeptReplies, keepReply, readKeptReply } from '../lib/keptReply';
import {
  docWords,
  isEmptyDoc,
  linkAddress,
  looksLikeMarkdown,
  markdownToDoc,
  toReplyDoc,
} from '../lib/replyDoc';
import { makeConversation, makeConversationMail, makeMailMessage } from './fixtures';
import { replyBox, replyDoc, replyEditor, replyWords, writeReply } from './reply-editor';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    getGmailStatus: vi.fn(),
    getAISettings: vi.fn(),
  },
}));

import { routeTree } from '../routeTree.gen';

const PRIYA = 'Priya Nair <priya.nair@northwind.example>';
const REPLY_PATH = '/api/mailbox/threads/thread-1/replies';
const text = (words: string, ...marks: object[]) =>
  marks.length ? { type: 'text', text: words, marks } : { type: 'text', text: words };
const p = (...content: object[]) => ({ type: 'paragraph', content });

let detail: ConversationDetail;
let thread: z.input<typeof MailThreadSchema>;
const post = vi.mocked(api.post);
const sent = () => post.mock.calls.filter(([path]) => path === REPLY_PATH);

function show(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { user: { id: 'u', email: 'u@test.local', name: 'U' } },
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const box = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /^(Reply to|Draft) .*/ }));
  return within(await screen.findByRole('form', { name: 'Reply' }));
};

beforeEach(() => {
  vi.resetAllMocks();
  detail = {
    conversation: makeConversation(),
    mails: [makeConversationMail()],
    sentAt: [],
    replyChoices: [],
  };
  thread = {
    threadId: 'thread-1',
    subject: detail.conversation.subject,
    messages: [makeMailMessage()],
    replyTo: PRIYA,
  };
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path.startsWith('/api/conversations/')) return detail;
    if (path.startsWith('/api/mailbox/threads/')) return thread;
    throw new ApiError('Not found', 'http', 404, 'NOT_FOUND');
  });
  post.mockImplementation(async (path: string) =>
    path === REPLY_PATH
      ? { id: 'sent-1', threadId: 'thread-1', sentAt: '2026-10-26T08:00:00.000Z' }
      : { seen: true },
  );
  vi.mocked(api.getGmailStatus).mockResolvedValue({
    connected: true,
    gmailEmail: 'me@example.com',
    status: 'CONNECTED',
    syncStatus: 'IDLE',
    lastSyncedAt: null,
    canSend: true,
  });
  vi.mocked(api.getAISettings).mockRejectedValue(new ApiError('n/a', 'http', 404));
});
afterEach(() => {
  cleanup();
});

describe('the rich text reply box (owner, 25 Oct 2026)', () => {
  it('sends the reply as its structure, with its formatting', async () => {
    show('/mails/thread-1');
    const form = await box();
    const editor = await replyEditor(form);
    act(() => {
      editor.commands.setContent({
        type: 'doc',
        content: [
          p(text('Free:')),
          {
            type: 'bulletList',
            content: [{ type: 'listItem', content: [p(text('Tuesday', { type: 'bold' }))] }],
          },
          p(text('portfolio', { type: 'link', attrs: { href: 'https://nitin.dev' } })),
        ],
      });
    });
    fireEvent.click(form.getByRole('button', { name: 'Send reply' }));
    await waitFor(() => expect(sent()).toHaveLength(1));
    expect(sent()[0][1]).toEqual({
      replyId: expect.any(String),
      doc: {
        type: 'doc',
        content: [
          p(text('Free:')),
          {
            type: 'bulletList',
            content: [{ type: 'listItem', content: [p(text('Tuesday', { type: 'bold' }))] }],
          },
          p(text('portfolio', { type: 'link', attrs: { href: 'https://nitin.dev' } })),
        ],
      },
    });
  });

  it('formats with the buttons beside Send, and says each shortcut', async () => {
    show('/mails/thread-1');
    const form = await box();
    await writeReply(form, 'Tuesday works.');
    const editor = await replyEditor(form);
    act(() => {
      editor.commands.selectAll();
    });
    const bold = within(form.getByRole('toolbar', { name: 'Format' })).getByRole('button', {
      name: 'Bold',
    });
    fireEvent.click(bold);
    await waitFor(() => expect(bold).toHaveAttribute('aria-pressed', 'true'));
    expect((await replyBox(form)).innerHTML).toBe('<p><strong>Tuesday works.</strong></p>');
    expect(
      within(form.getByRole('toolbar', { name: 'Format' }))
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Bold', 'Italic', 'Underline', 'Bulleted list', 'Numbered list', 'Link']);
  });

  it('keeps unsent text on this device, says so, and can discard it', async () => {
    show('/mails/thread-1');
    let form = await box();
    await writeReply(form, 'Tuesday works.');
    await waitFor(() => expect(readKeptReply('thread-1')).toEqual(replyDoc('Tuesday works.')));
    cleanup();

    // After a reload the closed bar says there is a draft, and the box brings it back.
    show('/mails/thread-1');
    expect(
      await screen.findByRole('button', { name: /^Draft to Priya Nair: Tuesday works\./ }),
    ).toBeInTheDocument();
    form = await box();
    expect(await replyWords(form)).toBe('Tuesday works.');
    expect(form.getByText('Not sent yet. Kept on this device only.')).toBeInTheDocument();

    fireEvent.click(form.getByRole('button', { name: 'Discard' }));
    await waitFor(async () => expect(await replyWords(form)).toBe(''));
    expect(readKeptReply('thread-1')).toBeNull();
    expect(form.queryByText('Not sent yet. Kept on this device only.')).not.toBeInTheDocument();
  });

  it('removes the kept text once the reply is sent', async () => {
    show('/mails/thread-1');
    const form = await box();
    await writeReply(form, 'Tuesday works.');
    await waitFor(() => expect(readKeptReply('thread-1')).not.toBeNull());
    fireEvent.click(form.getByRole('button', { name: 'Send reply' }));
    await waitFor(() => expect(sent()).toHaveLength(1));
    await waitFor(() => expect(readKeptReply('thread-1')).toBeNull());
  });

  it('turns pasted Markdown into formatting', async () => {
    show('/mails/thread-1');
    const form = await box();
    const editor = await replyEditor(form);
    const markdown = 'Free:\n\n- **Tuesday** after 3\n- Wednesday';
    const event = {
      clipboardData: { getData: (type: string) => (type === 'text/plain' ? markdown : '') },
    } as unknown as ClipboardEvent;
    act(() => {
      editor.view.someProp('handlePaste', (paste) => paste(editor.view, event, Slice.empty));
    });
    expect((await replyBox(form)).innerHTML).toBe(
      '<p>Free:</p><ul><li><p><strong>Tuesday</strong> after 3</p></li><li><p>Wednesday</p></li></ul>',
    );
  });

  it('shows the reply on its way with its formatting', async () => {
    let finish: (value: unknown) => void = () => {};
    post.mockImplementation((path: string) =>
      path === REPLY_PATH ? new Promise((resolve) => (finish = resolve)) : Promise.resolve({}),
    );
    show('/mails/thread-1');
    const form = await box();
    const editor = await replyEditor(form);
    act(() => {
      editor.commands.setContent({ type: 'doc', content: [p(text('Tuesday', { type: 'bold' }))] });
    });
    fireEvent.click(form.getByRole('button', { name: 'Send reply' }));
    const sending = await screen.findByRole('article', { name: 'Your reply, sending' });
    expect(within(sending).getByText('Tuesday').tagName).toBe('STRONG');
    finish({ id: 'sent-1', threadId: 'thread-1', sentAt: '2026-10-26T08:00:00.000Z' });
    await waitFor(() =>
      expect(
        screen.queryByRole('article', { name: 'Your reply, sending' }),
      ).not.toBeInTheDocument(),
    );
  });
});

describe('the reply as the server takes it', () => {
  it('keeps only the agreed formats and safe links, one level of lists', () => {
    expect(
      toReplyDoc({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'a', marks: [{ type: 'bold' }, { type: 'strike' }] },
              {
                type: 'text',
                text: 'b',
                marks: [{ type: 'link', attrs: { href: 'javascript:x' } }],
              },
              {
                type: 'text',
                text: 'c',
                marks: [{ type: 'link', attrs: { href: 'https://x.example', target: '_blank' } }],
              },
              { type: 'hardBreak' },
            ],
          },
          {
            type: 'orderedList',
            attrs: { start: 3, type: null },
            content: [
              {
                type: 'listItem',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'outer' }] },
                  {
                    type: 'bulletList',
                    content: [
                      {
                        type: 'listItem',
                        content: [
                          { type: 'paragraph', content: [{ type: 'text', text: 'inner' }] },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          { type: 'bulletList', content: [] },
          { type: 'paragraph' },
        ],
      }),
    ).toEqual({
      type: 'doc',
      content: [
        p(
          text('a', { type: 'bold' }),
          text('b'),
          text('c', { type: 'link', attrs: { href: 'https://x.example' } }),
          { type: 'hardBreak' },
        ),
        {
          type: 'orderedList',
          attrs: { start: 3 },
          content: [
            { type: 'listItem', content: [p(text('outer'))] },
            { type: 'listItem', content: [p(text('inner'))] },
          ],
        },
        { type: 'paragraph' },
      ],
    });
  });

  it('knows an empty reply and its first words', () => {
    expect(isEmptyDoc({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(true);
    expect(isEmptyDoc(replyDoc('  '))).toBe(true);
    const doc: DraftDoc = {
      type: 'doc',
      content: [
        p(text('Hi'), { type: 'hardBreak' }, text('Priya,')) as DraftDoc['content'][number],
        { type: 'bulletList', content: [{ type: 'listItem', content: [p(text('Tue')) as never] }] },
      ],
    };
    expect(isEmptyDoc(doc)).toBe(false);
    expect(docWords(doc)).toBe('Hi Priya, Tue');
  });

  it('reads pasted Markdown, and only when it looks like Markdown', () => {
    expect(looksLikeMarkdown('Just a sentence.')).toBe(false);
    expect(looksLikeMarkdown('- one\n- two')).toBe(true);
    expect(looksLikeMarkdown('see **this**')).toBe(true);
    expect(looksLikeMarkdown('[site](https://x.example)')).toBe(true);
    expect(markdownToDoc('Hi\nthere\n\n3. c\n4. d\n\n[bad](javascript:alert(1)) _ok_')).toEqual({
      type: 'doc',
      content: [
        p(text('Hi'), { type: 'hardBreak' }, text('there')),
        {
          type: 'orderedList',
          attrs: { start: 3 },
          content: [
            { type: 'listItem', content: [p(text('c'))] },
            { type: 'listItem', content: [p(text('d'))] },
          ],
        },
        p(text('bad'), text(' '), text('ok', { type: 'italic' })),
      ],
    });
  });

  it('makes a link from what the user typed, or refuses it', () => {
    expect(linkAddress('nitin.dev')).toBe('https://nitin.dev');
    expect(linkAddress(' https://nitin.dev/a?b=1 ')).toBe('https://nitin.dev/a?b=1');
    expect(linkAddress('priya@northwind.example')).toBe('mailto:priya@northwind.example');
    expect(linkAddress('mailto:priya@northwind.example')).toBe('mailto:priya@northwind.example');
    expect(linkAddress('javascript:alert(1)')).toBeNull();
    expect(linkAddress('not a link')).toBeNull();
    expect(linkAddress('')).toBeNull();
  });
});

describe('unsent text kept on this device', () => {
  it('keeps one per conversation, and drops all of them on sign-out', () => {
    keepReply('t1', replyDoc('One'));
    keepReply('t2', replyDoc('Two'));
    localStorage.setItem('other.key', 'stays');
    expect(readKeptReply('t1')).toEqual(replyDoc('One'));
    keepReply('t1', { type: 'doc', content: [{ type: 'paragraph' }] });
    expect(readKeptReply('t1')).toBeNull();
    dropAllKeptReplies();
    expect(readKeptReply('t2')).toBeNull();
    expect(localStorage.getItem('other.key')).toBe('stays');
  });

  it('ignores kept text it cannot read', () => {
    localStorage.setItem('northlist.reply.t1', '{not json');
    localStorage.setItem('northlist.reply.t2', JSON.stringify({ type: 'doc', content: 'x' }));
    expect(readKeptReply('t1')).toBeNull();
    expect(readKeptReply('t2')).toBeNull();
  });

  it('keeps nothing, and fails nothing, when the browser blocks storage', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => keepReply('t1', replyDoc('One'))).not.toThrow();
    expect(readKeptReply('t1')).toBeNull();
    setItem.mockRestore();
  });
});
