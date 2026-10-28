// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError, api } from '../api/client';
import type { ConversationDetail } from '../contracts/conversation';
import {
  makeApplication,
  makeConversation,
  makeConversationMail,
  makeMailMessage,
} from './fixtures';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    getGmailStatus: vi.fn(),
    getAISettings: vi.fn(),
    listApplications: vi.fn(),
  },
}));

import { routeTree } from '../routeTree.gen';

const PHONE_WIDTH = 375;
const ROW_NAME = 'Interview: first round availability, from Priya Nair';
const page = <T,>(items: T[]) => ({ items, metadata: { limit: 20, offset: 0, nextOffset: null } });

let detail: ConversationDetail;
let desktopWidth: number;
let router: ReturnType<typeof createRouter>;

const setWidth = (width: number) =>
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });

function show(path: string) {
  router = createRouter({
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

/** Drags an element to the right by `distance` pixels, as a finger does. */
function swipeRight(element: HTMLElement, distance: number) {
  fireEvent.pointerDown(element, { clientX: 20, pointerId: 1 });
  fireEvent.pointerMove(element, { clientX: 20 + distance / 2, pointerId: 1 });
  fireEvent.pointerMove(element, { clientX: 20 + distance, pointerId: 1 });
  fireEvent.pointerUp(element, { clientX: 20 + distance, pointerId: 1 });
}

beforeEach(() => {
  vi.resetAllMocks();
  desktopWidth = window.innerWidth;
  setWidth(PHONE_WIDTH);
  detail = {
    conversation: makeConversation(),
    mails: [makeConversationMail()],
    sentAt: [],
    replyChoices: [],
  };
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path.startsWith('/api/conversations?')) return page([detail.conversation]);
    if (path.startsWith('/api/conversations/')) return detail;
    if (path.startsWith('/api/mailbox/threads/'))
      return {
        threadId: 'thread-1',
        subject: detail.conversation.subject,
        messages: [makeMailMessage()],
        replyTo: 'Priya Nair <priya.nair@northwind.example>',
      };
    throw new ApiError('Not found', 'http', 404, 'NOT_FOUND');
  });
  vi.mocked(api.post).mockResolvedValue({ seen: true });
  vi.mocked(api.patch).mockResolvedValue(makeConversation());
  vi.mocked(api.getGmailStatus).mockResolvedValue({
    connected: true,
    gmailEmail: 'me@example.com',
    status: 'CONNECTED',
    syncStatus: 'IDLE',
    lastSyncedAt: null,
    canSend: true,
  });
  vi.mocked(api.getAISettings).mockRejectedValue(new ApiError('n/a', 'http', 404));
  vi.mocked(api.listApplications).mockResolvedValue(
    page([makeApplication({ companyName: 'Quanta Labs', jobTitle: 'Backend Engineer' })]),
  );
});
afterEach(() => {
  cleanup();
  setWidth(desktopWidth);
});

describe('phone top bar and menu', () => {
  it('opens every page from the menu cell, and keeps three pages in the bottom bar', async () => {
    show('/mails');
    await screen.findByRole('link', { name: ROW_NAME });
    const [, phoneBar] = screen.getAllByRole('navigation', { name: 'Main' });
    const bar = within(phoneBar);
    expect(bar.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Dashboard',
      'Mails',
      'Applications',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = within(await screen.findByRole('dialog', { name: 'Menu' }));
    const links = menu.getByRole('navigation', { name: 'Menu' }).querySelectorAll('a');
    expect(Array.from(links, (link) => link.textContent)).toEqual([
      'Dashboard',
      'Mails',
      'Applications',
      'Gmail sync',
      'AI providers',
      'Automation',
    ]);
    fireEvent.click(menu.getByRole('link', { name: 'Applications' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/applications'));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument(),
    );
  });

  it('puts the search one tap away, and the two filters used most as chips', async () => {
    show('/mails');
    await screen.findByRole('link', { name: ROW_NAME });
    fireEvent.click(screen.getByRole('button', { name: 'Search mails' }));
    expect(document.activeElement).toBe(document.getElementById('mail-search'));

    const needs = screen.getByRole('button', { name: 'Needs action', pressed: false });
    fireEvent.click(needs);
    await waitFor(() => expect(router.state.location.search).toMatchObject({ request: 'open' }));
    expect(screen.getByRole('button', { name: 'Needs action', pressed: true })).toBeInTheDocument();
  });
});

describe('phone lists', () => {
  it('shows a job mail as one row, and no swipe closes an ask answered by mail', async () => {
    show('/mails');
    const row = await screen.findByRole('link', { name: ROW_NAME });
    // The row's columns are not drawn: one tappable row instead.
    expect(row.closest('[role="row"]')!.querySelectorAll('[role="cell"]')).toHaveLength(1);
    swipeRight(row, 110);
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('swipes "I did this" on an ask done outside mail', async () => {
    const conversation = makeConversation();
    detail = {
      ...detail,
      conversation: {
        ...conversation,
        request: { ...conversation.request!, askKind: 'OUTSIDE_MAIL' },
      },
    };
    show('/mails');
    const row = await screen.findByRole('link', { name: ROW_NAME });
    swipeRight(row, 40);
    expect(api.patch).not.toHaveBeenCalled();
    swipeRight(row, 110);
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/api/conversations/thread-1/request', {
        emailId: '11111111-1111-4111-8111-111111111111',
        state: 'DONE',
      }),
    );
    // A swipe never also opens the mail.
    expect(router.state.location.pathname).toBe('/mails');
  });

  it('shows an application as a card, and adds one from the top bar', async () => {
    show('/applications');
    expect(await screen.findByRole('link', { name: /^Quanta Labs/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/applications\//),
    );
    const topBar = within(screen.getByRole('button', { name: 'Open menu' }).closest('header')!);
    fireEvent.click(topBar.getByRole('button', { name: 'Add application' }));
    expect(await screen.findByRole('dialog', { name: 'Add application' })).toBeInTheDocument();
  });
});

describe('phone mail details', () => {
  it('replies full screen from the floating button, and keeps the text when closed', async () => {
    show('/mails/thread-1');
    await screen.findByText('Send your available dates');
    // No reply bar under the conversation: the floating Reply button is the way in.
    expect(screen.queryByRole('button', { name: /^Reply to .*…/ })).not.toBeInTheDocument();
    // The job panel comes first, with its longer parts folded.
    expect(
      screen.getByRole('button', { name: 'Application', expanded: false }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    const form = within(await screen.findByRole('form', { name: 'Reply' }));
    fireEvent.change(form.getByLabelText('Your reply'), {
      target: { value: 'Tuesday works for me.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close reply' }));
    expect(screen.queryByRole('form', { name: 'Reply' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    expect(
      within(await screen.findByRole('form', { name: 'Reply' })).getByLabelText('Your reply'),
    ).toHaveValue('Tuesday works for me.');
  });
});
