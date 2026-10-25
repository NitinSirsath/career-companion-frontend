// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError, api } from '../api/client';
import type { ConversationDetail } from '../contracts/conversation';
import type { z } from 'zod';
import type { MailThreadSchema } from '../contracts/mailbox';
import { makeConversation, makeConversationMail, makeMailMessage } from './fixtures';

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
  post.mockResolvedValue({ seen: true });
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

describe('reply choices and "Write with AI" (owner, 24 Oct 2026)', () => {
  const DRAFT_PATH = '/api/conversations/thread-1/reply-draft';
  const box = async () => {
    fireEvent.click(await screen.findByRole('button', { name: /^Reply to .*…/ }));
    return within(await screen.findByRole('form', { name: 'Reply' }));
  };
  const draftAnswer = {
    text: 'Hi Priya,\n\nI am free:\n\n- Tuesday after 3 PM\n\nBest,\nNitin',
    doc: { type: 'doc', content: [] },
    model: 'GPT-6 Luna',
  };
  const answerDrafts = (answer: () => Promise<unknown>) =>
    post.mockImplementation(async (path: string) =>
      path === DRAFT_PATH ? answer() : { seen: true },
    );

  it('writes a draft from a reply choice into the box, and says who wrote it', async () => {
    detail = { ...detail, replyChoices: ['Send my free times', 'Decline politely'] };
    answerDrafts(async () => draftAnswer);
    show('/mails/thread-1');
    const form = await box();
    const help = within(form.getByRole('group', { name: 'Reply with AI' }));
    fireEvent.click(help.getByRole('button', { name: 'Send my free times' }));
    await waitFor(() => expect(form.getByLabelText('Your reply')).toHaveValue(draftAnswer.text));
    expect(post).toHaveBeenCalledWith(
      DRAFT_PATH,
      { choice: 'Send my free times' },
      undefined,
      100_000,
    );
    expect(
      form.getByText(
        'Written by GPT-6 Luna from the whole conversation. Check it before you send.',
      ),
    ).toBeInTheDocument();
    // Nothing is sent by itself.
    expect(sent()).toHaveLength(0);
  });

  it('writes from a one-line hint, and locks the box while it writes', async () => {
    let finish: (value: unknown) => void = () => {};
    answerDrafts(() => new Promise((resolve) => (finish = resolve)));
    show('/mails/thread-1');
    const form = await box();
    const help = within(form.getByRole('group', { name: 'Reply with AI' }));
    expect(help.getByText('Let the AI write it')).toBeInTheDocument();
    fireEvent.change(help.getByLabelText('What the AI should say (optional)'), {
      target: { value: "I'm free Tue after 3" },
    });
    fireEvent.click(help.getByRole('button', { name: 'Write with AI' }));
    expect(await form.findByText('Writing your reply from the whole conversation')).toHaveClass(
      'ai-shimmer',
    );
    expect(help.getByRole('button', { name: 'Write with AI' })).toBeDisabled();
    expect(post).toHaveBeenCalledWith(
      DRAFT_PATH,
      { hint: "I'm free Tue after 3" },
      undefined,
      100_000,
    );
    finish(draftAnswer);
    await waitFor(() => expect(form.getByLabelText('Your reply')).toHaveValue(draftAnswer.text));
  });

  it('drops a draft that comes after Stop, so the user can type instead', async () => {
    let finish: (value: unknown) => void = () => {};
    answerDrafts(() => new Promise((resolve) => (finish = resolve)));
    show('/mails/thread-1');
    const form = await box();
    fireEvent.click(form.getByRole('button', { name: 'Write with AI' }));
    fireEvent.click(await form.findByRole('button', { name: 'Stop' }));
    finish(draftAnswer);
    await waitFor(() => expect(form.getByRole('button', { name: 'Write with AI' })).toBeEnabled());
    expect(form.getByLabelText('Your reply')).toHaveValue('');
  });

  it('says why the AI could not write, and never sends anything', async () => {
    answerDrafts(async () => {
      throw new ApiError(
        'AI access cannot be used right now.',
        'http',
        409,
        'AI_ACCESS_UNAVAILABLE',
        {
          state: 'LIMITED',
          reason: 'PROVIDER_BUSY',
          resumesAt: null,
          modelId: null,
          failure: null,
        },
      );
    });
    show('/mails/thread-1');
    const form = await box();
    fireEvent.click(form.getByRole('button', { name: 'Write with AI' }));
    expect(
      await form.findByText(/^The AI is busy, so it could not write a reply\./),
    ).toBeInTheDocument();
    expect(sent()).toHaveLength(0);
  });

  it('offers no AI help when no AI is set up, only where to choose it', async () => {
    detail = { ...detail, replyChoices: ['Send my free times'] };
    vi.mocked(api.getAISettings).mockResolvedValue({ access: { state: 'NOT_SET_UP' } } as never);
    show('/mails/thread-1');
    const form = await box();
    expect(await form.findByRole('link', { name: 'Choose how mails are read' })).toHaveAttribute(
      'href',
      '/ai',
    );
    expect(form.queryByRole('button', { name: 'Write with AI' })).not.toBeInTheDocument();
    expect(form.queryByRole('button', { name: 'Send my free times' })).not.toBeInTheDocument();
  });
});
