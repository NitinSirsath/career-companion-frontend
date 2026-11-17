// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError, api } from '../api/client';
import type { ConversationDetail } from '../contracts/conversation';
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

let detail: ConversationDetail;
const get = vi.mocked(api.get);
const post = vi.mocked(api.post);

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
  get.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/conversations?'))
      return { items: [detail.conversation], metadata: { limit: 20, offset: 0, nextOffset: null } };
    if (path.startsWith('/api/conversations/')) return detail;
    if (path.startsWith('/api/mailbox/threads/'))
      return {
        threadId: 'thread-1',
        subject: detail.conversation.subject,
        messages: [makeMailMessage()],
        replyTo: detail.conversation.sender,
      };
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
afterEach(cleanup);

describe('career contacts and the "Link to" offer on the mail page (owner, 17 Nov 2026)', () => {
  const panel = async () => {
    show('/mails/thread-1');
    return within(await screen.findByRole('complementary', { name: 'About this job mail' }));
  };

  it('explains a career contact instead of offering an application', async () => {
    detail = {
      ...detail,
      conversation: makeConversation({
        sender: 'Joeri Brons <joeri@agensi.example>',
        category: 'CAREER_CONTACT',
        company: 'Agensi',
      }),
    };
    const side = await panel();
    expect(side.getByRole('heading', { name: 'About this mail' })).toBeInTheDocument();
    expect(
      side.getByText(
        'A career contact: Joeri writes about your work, not a job. No application needed.',
      ),
    ).toBeInTheDocument();
    expect(side.queryByRole('heading', { name: 'Application' })).not.toBeInTheDocument();
    expect(side.queryByRole('button', { name: /application/i })).not.toBeInTheDocument();
    expect(side.getByText('Send your available dates')).toBeInTheDocument();
  });

  it('offers the company’s application first and creating a new one second', async () => {
    detail = {
      ...detail,
      conversation: makeConversation({
        company: 'POOLit',
        role: 'Frontend Engineer',
        sameCompanyApplications: [
          {
            id: '33333333-3333-4333-8333-333333333333',
            companyName: 'POOLit',
            jobTitle: 'Front-end Developer',
          },
        ],
      }),
    };
    const side = await panel();
    expect(side.getByText('You already have an application at POOLit.')).toBeInTheDocument();
    const buttons = side
      .getAllByRole('button')
      .map((button) => button.textContent)
      .filter((text) => text?.includes('application') || text?.startsWith('Link'));
    expect(buttons).toEqual(['Link to POOLit · Front-end Developer', 'Create application']);
    expect(side.queryByText(/^One click/)).not.toBeInTheDocument();

    post.mockResolvedValue({});
    fireEvent.click(side.getByRole('button', { name: 'Link to POOLit · Front-end Developer' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/conversations/thread-1/application', {
        applicationId: '33333333-3333-4333-8333-333333333333',
      }),
    );
  });
});
