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
import { replyWords, writeReply } from './reply-editor';

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

describe('phone tab bar and Settings', () => {
  it('keeps four tabs in the tab bar, and every other page in the Settings tab', async () => {
    show('/mails');
    await screen.findByRole('link', { name: ROW_NAME });
    const bar = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(bar.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Dashboard',
      'Mails',
      'Applications',
      'Settings',
    ]);
    expect(bar.getByRole('link', { name: 'Mails' })).toHaveAttribute('aria-current', 'page');
    // No menu and no account button on phones: the Settings tab holds them.
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Account menu' })).not.toBeInTheDocument();

    fireEvent.click(bar.getByRole('link', { name: 'Settings' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/settings'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    for (const [name, href] of [
      ['Gmail sync', '/gmail'],
      ['AI providers', '/ai'],
      ['NorthList Apply', '/automation'],
      ['Account', '/account'],
      ['Appearance', '/settings/appearance'],
    ])
      expect(screen.getByRole('link', { name: new RegExp(`^${name}`) })).toHaveAttribute(
        'href',
        href,
      );
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('keeps refresh, search and filters in the glass capsule, and shows filters as pills', async () => {
    show('/mails');
    await screen.findByRole('link', { name: ROW_NAME });
    const capsule = within(screen.getByRole('group', { name: 'Mail tools' }));
    expect(capsule.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    // The search opens under the title, ready to type, with Cancel to close it.
    fireEvent.click(capsule.getByRole('button', { name: 'Search mails' }));
    expect(document.activeElement).toBe(document.getElementById('mail-search'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(document.getElementById('mail-search')).toBeNull();

    // The filters menu grows out of its button: the quick ones, the order, and every filter.
    fireEvent.click(capsule.getByRole('button', { name: 'Filter and sort' }));
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Needs action' }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ request: 'open' }));
    const pill = await screen.findByRole('button', { name: /^Remove filter Action: / });
    fireEvent.click(pill);
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('request'));
  });
});

describe('phone lists', () => {
  it('shows a job mail as one row, and no swipe closes an ask answered by mail', async () => {
    show('/mails');
    const row = await screen.findByRole('link', { name: ROW_NAME });
    // No table columns on a phone: one tappable row in a plain list.
    expect(row.closest('[role="listitem"]')!.querySelectorAll('[role="cell"]')).toHaveLength(0);
    swipeRight(row, 110);
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('marks a new mail with a dot in its own lane, and lines up every row at the text', async () => {
    detail.conversation = makeConversation({ isNew: true });
    show('/mails');
    const row = await screen.findByRole('link', { name: ROW_NAME });
    // The text starts 32px in on every row; the dot sits in the lane left of it (owner, 13 Nov 2026).
    expect(row).toHaveClass('pl-8');
    expect(row.querySelector('[data-new-dot]')).toHaveClass('left-[11px]', 'size-2.5');
    cleanup();
    detail.conversation = makeConversation({ isNew: false });
    show('/mails');
    const seen = await screen.findByRole('link', { name: ROW_NAME });
    expect(seen).toHaveClass('pl-8');
    expect(seen.querySelector('[data-new-dot]')).toBeNull();
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

  it('shows an application as a card, with no add button', async () => {
    show('/applications');
    expect(await screen.findByRole('link', { name: /^Quanta Labs/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/applications\//),
    );
    expect(screen.queryByRole('button', { name: 'Add application' })).not.toBeInTheDocument();
  });
});

describe('phone mail details', () => {
  it('replies full screen from the floating button, and keeps the text when closed', async () => {
    show('/mails/thread-1');
    await screen.findByText('Send your available dates');
    // No reply bar under the conversation: the floating Reply button is the way in.
    expect(screen.queryByRole('button', { name: /^Reply to .*…/ })).not.toBeInTheDocument();
    // The job panel comes first. A mail with no application keeps "Application" open.
    expect(screen.getByRole('button', { name: 'Create application' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    const form = within(await screen.findByRole('form', { name: 'Reply' }));
    // Send sits in the reply screen's top bar, as in phone mail apps.
    expect(await screen.findByRole('button', { name: 'Send' })).toHaveAttribute('type', 'submit');
    await writeReply(form, 'Tuesday works for me.');
    fireEvent.click(screen.getByRole('button', { name: 'Close reply' }));
    expect(screen.queryByRole('form', { name: 'Reply' })).not.toBeInTheDocument();

    // The text is kept, also on this device: the floating button says so.
    fireEvent.click(screen.getByRole('button', { name: 'Open draft' }));
    const again = within(await screen.findByRole('form', { name: 'Reply' }));
    expect(await replyWords(again)).toBe('Tuesday works for me.');
  });

  it('puts "Create application" right under the next step, with key dates behind ⓘ', async () => {
    detail.mails = [makeConversationMail({ interviewDate: 'Nov 12' })];
    show('/mails/thread-1');
    const create = await screen.findByRole('button', { name: 'Create application' });
    const top = screen.getByRole('group', { name: 'About this job mail' });
    expect(within(top).getByRole('region', { name: 'Application' })).toContainElement(create);
    expect(within(top).getByRole('button', { name: /^Next step: / })).toBeInTheDocument();
    // Key dates are not on the page, but in the ⓘ sheet.
    expect(screen.queryByText('Nov 12')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'About this job mail' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'About this job mail' }));
    expect(sheet.getByText('Key dates')).toBeInTheDocument();
    expect(sheet.getByText('Nov 12')).toBeInTheDocument();
  });

  it('keeps the application in the ⓘ sheet for a linked mail and a probable fake offer', async () => {
    detail.conversation = makeConversation({
      link: 'LINKED',
      application: {
        id: '7f1c2d3e-4b5a-4c6d-8e9f-0a1b2c3d4e5f',
        companyName: 'Northwind Robotics',
        jobTitle: 'Frontend Engineer',
        effectiveStatus: 'INTERVIEW',
        archived: false,
      },
    });
    show('/mails/thread-1');
    await screen.findByText('Send your available dates');
    expect(screen.queryByRole('button', { name: 'Create application' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'About this job mail' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'About this job mail' }));
    expect(sheet.getByRole('link', { name: /Northwind Robotics/ })).toHaveAttribute(
      'href',
      '/applications/7f1c2d3e-4b5a-4c6d-8e9f-0a1b2c3d4e5f',
    );
    cleanup();

    detail.conversation = makeConversation({ fakeOfferWarning: 'Asks you to pay to join' });
    show('/mails/thread-1');
    await screen.findByText('Send your available dates');
    expect(screen.queryByRole('button', { name: 'Create application' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'About this job mail' }));
    const fake = within(await screen.findByRole('dialog', { name: 'About this job mail' }));
    expect(fake.getByRole('button', { name: 'Create application' })).toBeInTheDocument();
  });

  it('has an action bar in place of the tab bar, and Back and ⓘ over the page', async () => {
    show('/mails/thread-1');
    await screen.findByText('Send your available dates');
    // A page opened from a list has no tab bar: its own action bar floats in its place.
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    const bar = within(screen.getByRole('navigation', { name: 'Mail actions' }));
    // An ask answered by mail has no "Done": the reply closes it.
    expect(bar.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Reply',
      'AI reply',
      'More',
    ]);
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About this job mail' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument();
  });

  it('marks an ask done outside mail as done from the action bar', async () => {
    const conversation = makeConversation();
    detail.conversation = {
      ...conversation,
      request: { ...conversation.request!, askKind: 'OUTSIDE_MAIL', canReply: false },
    };
    show('/mails/thread-1');
    const bar = within(await screen.findByRole('navigation', { name: 'Mail actions' }));
    fireEvent.click(bar.getByRole('button', { name: 'Done' }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/api/conversations/thread-1/request', {
        emailId: '11111111-1111-4111-8111-111111111111',
        state: 'DONE',
      }),
    );
  });

  it('opens the next step in a sheet with "I did this" and the way to its mail', async () => {
    const conversation = makeConversation();
    detail.conversation = {
      ...conversation,
      request: { ...conversation.request!, askKind: 'OUTSIDE_MAIL', canReply: false },
    };
    show('/mails/thread-1');
    fireEvent.click(await screen.findByRole('button', { name: /^Next step: / }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Next step' }));
    expect(sheet.getByText(/When you've done it, choose "I did this"\.$/)).toBeInTheDocument();
    fireEvent.click(sheet.getByRole('button', { name: 'I did this' }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/api/conversations/thread-1/request', {
        emailId: '11111111-1111-4111-8111-111111111111',
        state: 'DONE',
      }),
    );
  });

  it('shows the conversation\'s "⋯" actions in a sheet from More', async () => {
    show('/mails/thread-1');
    const bar = within(await screen.findByRole('navigation', { name: 'Mail actions' }));
    fireEvent.click(bar.getByRole('button', { name: 'More' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'This conversation' }));
    expect(sheet.getByRole('button', { name: 'Delete from NorthList…' })).toBeInTheDocument();
    expect(sheet.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('opens the reply with the AI hint ready from "AI reply"', async () => {
    show('/mails/thread-1');
    const bar = within(await screen.findByRole('navigation', { name: 'Mail actions' }));
    fireEvent.click(bar.getByRole('button', { name: 'AI reply' }));
    // One Reply sheet, with the AI's help inside it (owner, 13 Nov 2026).
    expect(await screen.findByRole('dialog', { name: 'Reply' })).toBeInTheDocument();
    await screen.findByRole('form', { name: 'Reply' });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByLabelText('What the AI should say (optional)'),
      ),
    );
  });
});
