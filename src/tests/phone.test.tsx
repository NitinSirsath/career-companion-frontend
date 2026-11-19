// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    getApplication: vi.fn(),
    updateApplicationStatus: vi.fn(),
  },
}));

import { routeTree } from '../routeTree.gen';
import { replyEditor, replyWords, writeReply } from './reply-editor';

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
  // jsdom has no visible-screen object: a test that makes one takes it away again.
  Reflect.deleteProperty(window, 'visualViewport');
});

describe('phone tab bar and Settings', () => {
  it('keeps four tabs in the tab bar, and every other page in the Settings tab', async () => {
    show('/mails');
    await screen.findByRole('link', { name: ROW_NAME });
    const bar = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(bar.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Today',
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

  it('keeps Filter and ··· in the glass capsule, the sync time in ···, and filters as pills', async () => {
    show('/mails');
    await screen.findByRole('link', { name: ROW_NAME });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Mails$/);
    const capsule = within(screen.getByRole('group', { name: 'Mail tools' }));
    // ···: when mail came in, Refresh, and Search (mock `PHONE-LINEAR-mock/` #1).
    fireEvent.click(capsule.getByRole('button', { name: 'More' }));
    const more = within(await screen.findByRole('menu', { name: 'More' }));
    expect(more.getByText('Not synced yet')).toBeInTheDocument();
    expect(more.getByRole('menuitem', { name: 'Refresh' })).toBeInTheDocument();
    fireEvent.keyDown(more.getByRole('menuitem', { name: 'Refresh' }), { key: 'Escape' });
    // The tab bar's Search circle opens the search under the title, ready to type, with Cancel.
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(document.getElementById('mail-search')),
    );
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

  it('shows company · ask · due on the third line, red only once past due', async () => {
    detail.conversation = makeConversation({
      link: 'LINKED',
      company: 'Northwind (as the AI read it)',
      application: {
        id: '7f1c2d3e-4b5a-4c6d-8e9f-0a1b2c3d4e5f',
        companyName: 'Northwind Robotics',
        jobTitle: 'Frontend Engineer',
        effectiveStatus: 'INTERVIEW',
        archived: false,
        decline: null,
        closedAfterDeclineAt: null,
      },
    });
    show('/mails');
    let row = await screen.findByRole('link', { name: ROW_NAME });
    // The application's name wins: the user may have corrected what the AI read.
    expect(within(row).getByText('Northwind Robotics')).toBeInTheDocument();
    expect(within(row).getByText('Send your available dates')).toBeInTheDocument();
    cleanup();
    const conversation = makeConversation({ company: 'Quanta Labs', application: null });
    detail.conversation = {
      ...conversation,
      request: {
        ...conversation.request!,
        deadline: '2020-01-10T00:00:00.000Z',
        deadlinePrecision: 'DATE',
      },
    };
    show('/mails');
    row = await screen.findByRole('link', { name: ROW_NAME });
    expect(within(row).getByText('Quanta Labs')).toBeInTheDocument();
    expect(within(row).getByText('Past due Jan 10')).toHaveClass('text-late');
  });

  it('marks a new mail with a blue dot before the name, and the status ring on the photo', async () => {
    detail.conversation = makeConversation({
      isNew: true,
      link: 'LINKED',
      application: {
        id: '7f1c2d3e-4b5a-4c6d-8e9f-0a1b2c3d4e5f',
        companyName: 'Northwind Robotics',
        jobTitle: 'Frontend Engineer',
        effectiveStatus: 'INTERVIEW',
        archived: false,
        decline: null,
        closedAfterDeclineAt: null,
      },
    });
    show('/mails');
    const row = await screen.findByRole('link', { name: ROW_NAME });
    const dot = row.querySelector('[data-new-dot]')!;
    expect(dot).toHaveClass('bg-accent', 'size-2');
    expect(dot.nextElementSibling).toHaveTextContent('Priya Nair');
    expect(within(row).getByText('PN')).toBeInTheDocument();
    expect(row.querySelector('[data-ring]')).not.toBeNull();
    cleanup();
    detail.conversation = makeConversation({ isNew: false, application: null });
    show('/mails');
    const seen = await screen.findByRole('link', { name: ROW_NAME });
    expect(seen.querySelector('[data-new-dot]')).toBeNull();
    expect(seen.querySelector('[data-ring]')).toBeNull();
  });

  it('shows the Whole inbox as rows like Job mails, lined up with the title', async () => {
    const mail = {
      threadId: 'gmail-1',
      subject: 'Security alert',
      from: 'Google <no-reply@accounts.google.com>',
      date: '2026-10-11T03:45:00.000Z',
      snippet: 'A new sign-in on Mac',
      messageCount: 1,
      unread: false,
      conversationKey: null,
    };
    const job = {
      ...mail,
      threadId: 'gmail-2',
      subject: 'Interview',
      from: 'Priya Nair <p@n.example>',
    };
    const listed = {
      items: [{ ...job, unread: true, conversationKey: 'conv-9' }, mail],
      nextPageToken: null,
    };
    const answer = vi.mocked(api.get).getMockImplementation()!;
    vi.mocked(api.get).mockImplementation(async (path: string, ...rest) =>
      path === '/api/mailbox/threads' ? listed : answer(path, ...rest),
    );
    show('/mails?tab=gmail');
    const jobRow = await screen.findByRole('link', { name: 'Interview, from Priya Nair, unread' });
    // One tappable row in a plain list, its words 20px in, under the title's first letter.
    expect(jobRow).toHaveAttribute('href', '/mails/conv-9');
    expect(jobRow).toHaveClass('pl-5');
    expect(within(jobRow).getByText('Job mail')).toBeInTheDocument();
    expect(jobRow.closest('[role="listitem"]')!.querySelectorAll('[role="cell"]')).toHaveLength(0);
    const other = screen.getByRole('link', { name: 'Security alert, from Google' });
    expect(other).toHaveAttribute('href', '/mails/gmail/gmail-1');
    expect(within(other).queryByText('Job mail')).toBeNull();
    expect(within(other).getByText('A new sign-in on Mac')).toBeInTheDocument();
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

describe('phone loaders', () => {
  /** The answer for `path` never comes, so the page keeps its loader. */
  const neverAnswer = (prefix: string) => {
    const answer = vi.mocked(api.get).getMockImplementation()!;
    vi.mocked(api.get).mockImplementation((path: string, ...rest) =>
      path.startsWith(prefix) ? new Promise(() => {}) : answer(path, ...rest),
    );
  };
  /** The loader that says `label` to screen readers. */
  const loaderFor = async (label: string) =>
    (await screen.findByText(label)).closest<HTMLElement>('[role="status"]')!;
  // The grey rows sit inside the edge-to-edge list and take its 20px side space, like the rows.
  const expectInset = (loader: HTMLElement) => {
    expect(loader.closest('.phone-bleed')).not.toBeNull();
    expect(loader).toHaveClass('px-[var(--list-inset,0px)]');
  };

  it('keeps the Job mails and Whole inbox loaders 20px from the screen edge', async () => {
    neverAnswer('/api/conversations?');
    show('/mails');
    expectInset(await loaderFor('Loading job mails'));
    cleanup();
    neverAnswer('/api/mailbox/threads');
    show('/mails?tab=gmail');
    expectInset(await loaderFor('Loading the inbox'));
  });

  it('keeps the mail page loader 20px from the screen edge', async () => {
    neverAnswer('/api/mailbox/threads/');
    show('/mails/conv-1');
    expectInset(await loaderFor('Reading this mail from Gmail'));
  });

  it('shows loader lines, not a pile of cells, while Applications loads', async () => {
    vi.mocked(api.listApplications).mockReturnValue(new Promise(() => {}));
    show('/applications');
    const loader = await loaderFor('Loading applications');
    // Plain rows (owner, 18 Nov 2026): the lines start at a row's edge, with no grey group.
    expect(loader).toHaveClass('px-[18px]');
    expect(loader).not.toHaveClass('px-[var(--list-inset,0px)]');
    expect(screen.queryAllByRole('cell')).toHaveLength(0);
  });
});

describe('phone mail details', () => {
  /** Opens the key dates and application sheet from the ··· menu. */
  const openInfo = async () => {
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Mail tools' })).getByRole('button', {
        name: 'More',
      }),
    );
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Key dates and application' }));
  };

  it('lists the mails oldest at the top, like the laptop (owner, 19 Nov 2026)', async () => {
    vi.mocked(api.get).mockImplementation(async (path: string) => {
      if (path.startsWith('/api/conversations/')) return detail;
      if (path.startsWith('/api/mailbox/threads/'))
        return {
          threadId: 'thread-1',
          subject: detail.conversation.subject,
          messages: [
            makeMailMessage(),
            makeMailMessage({
              id: 'message-2',
              from: 'Me <me@example.com>',
              date: '2026-10-12T05:12:00.000Z',
              sentByUser: true,
              text: 'Tuesday works for me.',
            }),
          ],
          replyTo: 'Priya Nair <priya.nair@northwind.example>',
        };
      throw new ApiError('Not found', 'http', 404, 'NOT_FOUND');
    });
    show('/mails/conv-1');
    const first = await screen.findByText(/Could you share the dates/);
    const second = await screen.findByText(/Tuesday works for me/);
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

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

  it('keeps Send grey until there is text, and the Gmail note on one line above the text tools', async () => {
    show('/mails/thread-1');
    await screen.findByText('Send your available dates');
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    const form = within(await screen.findByRole('form', { name: 'Reply' }));
    await replyEditor(form);
    const send = await screen.findByRole('button', { name: 'Send' });
    expect(send).toBeDisabled();
    await writeReply(form, 'Tuesday works for me.');
    expect(send).toBeEnabled();
    await writeReply(form, '');
    expect(send).toBeDisabled();

    // One short line, in the sheet's bottom bar with the text tools, not under the text.
    const note = screen.getByText('Sent from your Gmail');
    expect(screen.getByRole('form', { name: 'Reply' })).not.toContainElement(note);
    expect(note.parentElement?.nextElementSibling).toContainElement(
      screen.getByRole('toolbar', { name: 'Format' }),
    );
    expect(within(note).getByRole('link', { name: /in Gmail$/ })).toBeInTheDocument();
  });

  it('opens the AI help from ✦ AI in the tool bar, and shrinks it to one row while typing', async () => {
    detail.replyChoices = ['Confirm my availability', 'Request another time'];
    // The phone's visible screen: as tall as the page until the keyboard comes up.
    const viewport = Object.assign(new EventTarget(), { height: window.innerHeight, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    show('/mails/thread-1');
    await screen.findByText('Send your available dates');
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    const form = within(await screen.findByRole('form', { name: 'Reply' }));
    const hintLabel = 'What the AI should say (optional)';
    // A plain Reply opens on the text; ✦ AI in the glass tool bar opens the AI help (mock #4).
    expect(form.queryByLabelText(hintLabel)).not.toBeInTheDocument();
    const tools = within(screen.getByRole('group', { name: 'Reply tools' }));
    expect(await tools.findByRole('toolbar', { name: 'Format' })).toBeInTheDocument();
    fireEvent.click(await tools.findByRole('button', { name: 'Reply with AI' }));
    // The choices side by side, and the hint with its own small Write button.
    expect(
      await form.findByRole('button', { name: 'Confirm my availability' }),
    ).toBeInTheDocument();
    expect(form.getByLabelText(hintLabel)).toBeInTheDocument();
    expect(form.getByRole('button', { name: 'Write with AI' })).toBeInTheDocument();

    // The text has the focus when the sheet opens, but no keyboard is up yet: the box stays.
    const editor = await replyEditor(form);
    act(() => {
      editor.commands.focus();
    });
    expect(form.getByLabelText(hintLabel)).toBeInTheDocument();

    // The keyboard comes up: the visible part of the screen gets shorter.
    act(() => {
      viewport.height = window.innerHeight - 300;
      viewport.dispatchEvent(new Event('resize'));
    });
    const row = await form.findByRole('button', { name: 'Reply with AI', expanded: false });
    expect(row).toHaveAttribute('aria-expanded', 'false');
    expect(form.queryByLabelText(hintLabel)).not.toBeInTheDocument();
    expect(form.queryByRole('button', { name: 'Confirm my availability' })).not.toBeInTheDocument();

    fireEvent.click(row);
    expect(form.getByLabelText(hintLabel)).toHaveFocus();
    expect(form.getByRole('button', { name: 'Confirm my availability' })).toBeInTheDocument();
  });

  it('puts "Create application" right under the next step, with key dates behind ···', async () => {
    detail.mails = [makeConversationMail({ interviewDate: 'Nov 12' })];
    show('/mails/thread-1');
    const create = await screen.findByRole('button', { name: 'Create application' });
    const top = screen.getByRole('group', { name: 'About this job mail' });
    expect(within(top).getByRole('region', { name: 'Application' })).toContainElement(create);
    expect(within(top).getByRole('button', { name: /^Next step: / })).toBeInTheDocument();
    // Key dates are not on the page, but in a sheet from ···.
    expect(screen.queryByText('Nov 12')).not.toBeInTheDocument();
    await openInfo();
    const sheet = within(await screen.findByRole('dialog', { name: 'About this job mail' }));
    expect(sheet.getByText('Key dates')).toBeInTheDocument();
    expect(sheet.getByText('Nov 12')).toBeInTheDocument();
  });

  it('keeps the application in the key dates sheet for a linked mail and a probable fake offer', async () => {
    detail.conversation = makeConversation({
      link: 'LINKED',
      application: {
        id: '7f1c2d3e-4b5a-4c6d-8e9f-0a1b2c3d4e5f',
        companyName: 'Northwind Robotics',
        jobTitle: 'Frontend Engineer',
        effectiveStatus: 'INTERVIEW',
        archived: false,
        decline: null,
        closedAfterDeclineAt: null,
      },
    });
    show('/mails/thread-1');
    await screen.findByText('Send your available dates');
    expect(screen.queryByRole('button', { name: 'Create application' })).not.toBeInTheDocument();
    await openInfo();
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
    await openInfo();
    const fake = within(await screen.findByRole('dialog', { name: 'About this job mail' }));
    expect(fake.getByRole('button', { name: 'Create application' })).toBeInTheDocument();
  });

  it('has AI reply · Reply · Open in Gmail in place of the tab bar, and Back and ··· over the page', async () => {
    show('/mails/thread-1');
    await screen.findByText('Send your available dates');
    // A page opened from a list has no tab bar: its own bottom bar floats in its place.
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    const bar = within(screen.getByRole('navigation', { name: 'Mail actions' }));
    expect(bar.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      'AI reply',
      'Reply',
      'Open in Gmail',
    ]);
    expect(bar.getByRole('button', { name: 'Reply' })).toHaveTextContent('Reply to Priya Nair');
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    fireEvent.click(bar.getByRole('button', { name: 'Open in Gmail' }));
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining('mail.google.com'),
      '_blank',
      'noopener,noreferrer',
    );
    open.mockRestore();
    // Grey "who · when", the subject, "For …", and the facts as pills in one card.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Interview: first round availability',
    );
    expect(screen.getByRole('group', { name: 'About this mail' })).toHaveTextContent('Priya Nair');
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    // An ask answered by mail has no "Done": the reply closes it.
    const tools = within(screen.getByRole('group', { name: 'Mail tools' }));
    expect(tools.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(tools.getByRole('button', { name: 'More' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument();
  });

  it('opens the Status sheet from the status pill, and saves the choice as the application page does', async () => {
    const id = '7f1c2d3e-4b5a-4c6d-8e9f-0a1b2c3d4e5f';
    detail.conversation = makeConversation({
      link: 'LINKED',
      application: {
        id,
        companyName: 'Northwind Robotics',
        jobTitle: 'Frontend Engineer',
        effectiveStatus: 'RECRUITER_CONTACT',
        archived: false,
        decline: null,
        closedAfterDeclineAt: null,
      },
    });
    const app = makeApplication({ id, aiStatus: 'RECRUITER_CONTACT' });
    vi.mocked(api.getApplication).mockResolvedValue(app);
    vi.mocked(api.updateApplicationStatus).mockResolvedValue(
      makeApplication({
        id,
        aiStatus: 'RECRUITER_CONTACT',
        userStatus: 'INTERVIEW',
        userStatusRevision: 1,
      }),
    );
    show('/mails/thread-1');
    // "For ◔ company · role" opens the application.
    expect(
      await screen.findByRole('link', {
        name: 'For Northwind Robotics · Frontend Engineer. Open the application',
      }),
    ).toHaveAttribute('href', `/applications/${id}`);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Status: Recruiter contact. Change status' }),
    );
    const sheet = within(await screen.findByRole('dialog', { name: 'Status' }));
    fireEvent.click(sheet.getByRole('radio', { name: 'Interview' }));
    await waitFor(() =>
      expect(api.updateApplicationStatus).toHaveBeenCalledWith(id, {
        userStatus: 'INTERVIEW',
        expectedUserStatusRevision: 0,
      }),
    );
    expect(
      await screen.findByRole('button', { name: 'Status: Interview. Change status' }),
    ).toBeInTheDocument();
  });

  it('marks an ask done outside mail as done from the top capsule', async () => {
    const conversation = makeConversation();
    detail.conversation = {
      ...conversation,
      request: { ...conversation.request!, askKind: 'OUTSIDE_MAIL', canReply: false },
    };
    show('/mails/thread-1');
    await screen.findByText('Send your available dates');
    const tools = within(screen.getByRole('group', { name: 'Mail tools' }));
    fireEvent.click(tools.getByRole('button', { name: 'Done' }));
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

  it('shows the conversation\'s "⋯" actions in the ··· menu', async () => {
    show('/mails/thread-1');
    await screen.findByText('Send your available dates');
    const tools = within(screen.getByRole('group', { name: 'Mail tools' }));
    fireEvent.click(tools.getByRole('button', { name: 'More' }));
    const menu = within(await screen.findByRole('menu', { name: 'More' }));
    expect(menu.getByRole('menuitem', { name: 'Key dates and application' })).toBeInTheDocument();
    expect(menu.getByRole('menuitem', { name: 'Delete from NorthList…' })).toBeInTheDocument();
  });

  it('opens the reply with the AI hint ready from "AI reply"', async () => {
    show('/mails/thread-1');
    await screen.findByText('Send your available dates');
    const bar = within(screen.getByRole('navigation', { name: 'Mail actions' }));
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
