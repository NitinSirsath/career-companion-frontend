// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError, api } from '../api/client';
import type { Conversation } from '../contracts/conversation';
import type { MailboxThread } from '../contracts/mailbox';
import { makeConversation } from './fixtures';

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
import { chooseOption, pressOption } from './choose';
import { listSearch } from '../lib/listMemory';

const APP_ID = '33333333-3333-4333-8333-333333333333';
const page = <T,>(items: T[], nextOffset: number | null = null) => ({
  items,
  metadata: { limit: 20, offset: 0, nextOffset },
});
const thread = (overrides: Partial<MailboxThread> = {}): MailboxThread => ({
  threadId: 'gmail-1',
  subject: 'Security alert',
  from: 'Google <no-reply@accounts.google.com>',
  date: '2026-10-11T03:45:00.000Z',
  snippet: 'A new sign-in on Mac. If this wasn&#39;t you, check it',
  messageCount: 1,
  unread: false,
  conversationKey: null,
  ...overrides,
});

let conversations: Conversation[];
let inbox: Record<string, { items: MailboxThread[]; nextPageToken: string | null }>;
const get = vi.mocked(api.get);
const listCalls = () =>
  get.mock.calls.map(([path]) => path).filter((path) => path.startsWith('/api/conversations?'));

let router: ReturnType<typeof createRouter>;
function show(path = '/mails') {
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
const row = async (subject: string) =>
  within(
    (await screen.findByRole('link', { name: subject })).closest<HTMLElement>('[role="row"]')!,
  );
/** Opens a row's "…" menu and returns its items' names. */
const openRowMenu = async (cells: ReturnType<typeof within>) => {
  fireEvent.click(cells.getByRole('button', { name: /^Actions for/ }));
  return (await screen.findAllByRole('menuitem')).map((item) => item.textContent);
};

beforeEach(() => {
  vi.resetAllMocks();
  conversations = [makeConversation()];
  inbox = { '': { items: [thread()], nextPageToken: null } };
  get.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/conversations?')) return page(conversations);
    if (path.startsWith('/api/mailbox/threads')) {
      const token = new URLSearchParams(path.split('?')[1]).get('pageToken') ?? '';
      return inbox[token];
    }
    throw new ApiError('Not found', 'http', 404, 'NOT_FOUND');
  });
  vi.mocked(api.getGmailStatus).mockResolvedValue({
    connected: true,
    gmailEmail: 'you@gmail.com',
    status: 'CONNECTED',
    syncStatus: 'IDLE',
    lastSyncedAt: null,
  });
  vi.mocked(api.getAISettings).mockRejectedValue(new ApiError('n/a', 'http', 404));
});
afterEach(cleanup);

describe('home and navigation', () => {
  it('lands on Mails, and lists Mails first with Agenda after Applications', async () => {
    show('/');
    expect(await screen.findByRole('heading', { name: 'Mails' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/mails');
    // The desktop sidebar and the phone bar: both are in the page, one is shown. Agenda is not in
    // the menu until it works; settings sit in their own group after the daily pages.
    const [sidebar, phoneBar] = screen.getAllByRole('navigation', { name: 'Main' });
    expect(
      within(sidebar)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Mails', 'Applications', 'Dashboard', 'Gmail sync', 'AI provider', 'Automation']);
    expect(within(sidebar).getByText('Settings')).toBeInTheDocument();
    expect(
      within(phoneBar)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Mails', 'Applications', 'Dashboard']);
    expect(within(phoneBar).getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('names the page in the top bar, with the logo and the account button', async () => {
    show('/mails');
    expect(await screen.findByRole('heading', { name: 'Mails' })).toBeInTheDocument();
    const logo = screen.getByRole('link', { name: 'Career Companion' });
    expect(logo).toHaveAttribute('href', '/mails');
    const bar = within(logo.closest('header')!);
    expect(
      within(bar.getByRole('navigation', { name: 'Breadcrumb' })).getByText('Mails'),
    ).toHaveAttribute('aria-current', 'page');
    expect(bar.getByRole('button', { name: 'Account menu' })).toBeInTheDocument();
  });

  it('shrinks the side menu to icons and remembers it', async () => {
    localStorage.removeItem('career-companion-menu');
    show('/mails');
    fireEvent.click(await screen.findByRole('button', { name: 'Collapse menu' }));
    expect(screen.getByRole('button', { name: 'Expand menu' })).toBeInTheDocument();
    expect(localStorage.getItem('career-companion-menu')).toBe('collapsed');
    // The links keep their names for screen readers while only icons show.
    const [sidebar] = screen.getAllByRole('navigation', { name: 'Main' });
    expect(within(sidebar).getByRole('link', { name: 'Applications' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand menu' }));
    expect(localStorage.getItem('career-companion-menu')).toBe('open');
  });

  it('keeps Account, the theme and Log out in one account menu', async () => {
    show('/mails');
    fireEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
    expect(await screen.findByRole('menuitem', { name: 'Account' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Log out' })).toBeInTheDocument();
    expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
      'System',
      'Light',
      'Dark',
    ]);
  });

  it('remembers the list filters, so the breadcrumb on a mail returns to the same view', async () => {
    show('/mails?request=open&unseen=true');
    expect(await screen.findByRole('heading', { name: 'Mails' })).toBeInTheDocument();
    expect(listSearch('/mails')).toEqual({ request: 'open', unseen: true });
  });

  it('shows only "Coming soon" on the Dashboard, with the way to Mails', async () => {
    show('/dashboard');
    expect(await screen.findByText('Coming soon')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Open Mails' }));
    expect(await screen.findByRole('heading', { name: 'Mails' })).toBeInTheDocument();
  });

  it('shows only "Coming soon" on the Agenda, and none of the earlier Agenda page', async () => {
    show('/agenda');
    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeInTheDocument();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    expect(
      screen.getByText(/each date is shown on its mail, on the Mails page/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Upcoming|Needs review/ })).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Open Mails' }));
    expect(await screen.findByRole('heading', { name: 'Mails' })).toBeInTheDocument();
  });
});

describe('Job mails tab', () => {
  it('shows a new job mail with its action and a one-click Create application', async () => {
    show();
    const cells = await row('Interview: first round availability');
    expect(cells.getByText('New')).toBeInTheDocument();
    expect(cells.getByText('Priya Nair · Northwind Robotics · 1 mail')).toBeInTheDocument();
    expect(cells.getByText('Interview')).toBeInTheDocument();
    expect(cells.getByText('Send your available dates')).toBeInTheDocument();
    expect(cells.getByText('Needs action')).toBeInTheDocument();
    expect(cells.getByText('Due Oct 13, 2026')).toBeInTheDocument();
    expect(cells.getByText('Not linked')).toBeInTheDocument();
    expect(
      cells.getByRole('link', { name: 'Interview: first round availability' }),
    ).toHaveAttribute('href', '/mails/thread-1');
    expect(screen.getByRole('tab', { name: /^Job mails/ })).toHaveTextContent('Job mails1');

    vi.mocked(api.post).mockResolvedValue({});
    fireEvent.click(cells.getByRole('button', { name: 'Create application' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/api/conversations/thread-1/application', {}),
    );
  });

  it('shows a linked application with its stage, and "Update" for a status mail', async () => {
    conversations = [
      makeConversation({
        isNew: false,
        category: 'FOLLOW_UP',
        request: null,
        link: 'LINKED',
        application: {
          id: APP_ID,
          companyName: 'Umbrella Labs',
          jobTitle: 'Product Analyst',
          effectiveStatus: 'APPLIED',
          archived: false,
        },
      }),
    ];
    show();
    const cells = await row('Interview: first round availability');
    expect(cells.getByText('Update')).toBeInTheDocument();
    expect(cells.getByText('Nothing needed')).toBeInTheDocument();
    expect(cells.queryByText('New')).not.toBeInTheDocument();
    expect(cells.getByRole('link', { name: 'Umbrella Labs' })).toHaveAttribute(
      'href',
      `/applications/${APP_ID}`,
    );
    expect(cells.getByText('Applied')).toBeInTheDocument();
    // No big buttons in a row: only its "…" menu.
    expect(cells.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Actions for Interview: first round availability',
    ]);
  });

  it('marks an action done and reopens it, naming the mail that asked', async () => {
    vi.mocked(api.patch).mockResolvedValue(makeConversation());
    show();
    await openRowMenu(await row('Interview: first round availability'));
    pressOption(screen.getByRole('menuitem', { name: 'Mark done' }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/api/conversations/thread-1/request', {
        emailId: '11111111-1111-4111-8111-111111111111',
        state: 'DONE',
      }),
    );
    cleanup();

    const done = makeConversation();
    conversations = [{ ...done, request: { ...done.request!, state: 'DONE' } }];
    show();
    const cells = await row('Interview: first round availability');
    expect(cells.getByText('Done')).toBeInTheDocument();
    await openRowMenu(cells);
    pressOption(screen.getByRole('menuitem', { name: 'Reopen' }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenLastCalledWith(
        '/api/conversations/thread-1/request',
        expect.objectContaining({ state: 'OPEN' }),
      ),
    );
  });

  it('offers "Ask me again" after the user replied', async () => {
    const replied = makeConversation({ sentCount: 1 });
    conversations = [
      {
        ...replied,
        request: { ...replied.request!, state: 'REPLIED', repliedAt: '2026-10-09T10:00:00.000Z' },
      },
    ];
    show();
    const cells = await row('Interview: first round availability');
    expect(cells.getByText('Replied')).toBeInTheDocument();
    expect(cells.getByText(/^You replied /)).toBeInTheDocument();
    expect(await openRowMenu(cells)).toEqual(['Mark done', 'Ask me again', 'Open in Gmail']);
  });

  it('asks for the company when the AI could not read one', async () => {
    conversations = [makeConversation({ company: null, role: null })];
    vi.mocked(api.post).mockRejectedValueOnce(
      new ApiError('Enter the company name.', 'http', 400, 'COMPANY_REQUIRED'),
    );
    show();
    const cells = await row('Interview: first round availability');
    fireEvent.click(cells.getByRole('button', { name: 'Create application' }));
    const company = await cells.findByLabelText('Company name');
    fireEvent.click(cells.getByRole('button', { name: 'Create application' }));
    expect(await cells.findByText('Enter the company name.')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(1);

    vi.mocked(api.post).mockResolvedValue({});
    fireEvent.change(company, { target: { value: ' Northwind ' } });
    fireEvent.click(cells.getByRole('button', { name: 'Create application' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenLastCalledWith('/api/conversations/thread-1/application', {
        companyName: 'Northwind',
      }),
    );
  });

  it('offers only the applications that fit when there is more than one', async () => {
    conversations = [makeConversation({ link: 'NEEDS_REVIEW' })];
    vi.mocked(api.post).mockRejectedValueOnce(
      new ApiError('Choose one.', 'http', 409, 'APPLICATION_CHOICE_REQUIRED', {
        candidates: [
          { id: APP_ID, companyName: 'Northwind Robotics', jobTitle: 'Platform Engineer' },
          {
            id: '44444444-4444-4444-8444-444444444444',
            companyName: 'Northwind Robotics',
            jobTitle: null,
          },
        ],
      }),
    );
    show();
    const cells = await row('Interview: first round availability');
    fireEvent.click(cells.getByRole('button', { name: 'Choose application' }));
    await cells.findByRole('combobox', { name: 'Choose an application' });
    expect(cells.getByRole('button', { name: 'Use this application' })).toBeDisabled();
    fireEvent.click(cells.getByRole('button', { name: 'Open Choose an application' }));
    expect(await screen.findAllByRole('option')).toHaveLength(2);

    vi.mocked(api.post).mockResolvedValue({});
    pressOption(screen.getByRole('option', { name: /Platform Engineer/ }));
    fireEvent.click(cells.getByRole('button', { name: 'Use this application' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenLastCalledWith('/api/conversations/thread-1/application', {
        applicationId: APP_ID,
      }),
    );
  });

  it('keeps the filters in the URL and sends them to the list', async () => {
    show('/mails?offset=20');
    await row('Interview: first round availability');
    await chooseOption(screen.getByRole('combobox', { name: 'Action' }), 'Needs action');
    await chooseOption(screen.getByRole('combobox', { name: 'Type' }), 'Update');
    await chooseOption(screen.getByRole('combobox', { name: 'Application' }), 'No application yet');
    await chooseOption(screen.getByRole('combobox', { name: 'Sort' }), 'Newest first');
    fireEvent.click(screen.getByLabelText('New only'));
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'north' } });
    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        request: 'open',
        category: 'FOLLOW_UP',
        application: 'none',
        sort: 'newest',
        unseen: true,
        q: 'north',
      }),
    );
    await waitFor(() => {
      const query = new URLSearchParams(listCalls().slice(-1)[0].split('?')[1]);
      expect(Object.fromEntries(query)).toEqual({
        limit: '20',
        offset: '0',
        request: 'open',
        category: 'FOLLOW_UP',
        application: 'none',
        sort: 'newest',
        unseen: 'true',
        q: 'north',
      });
    });
  });

  it('says so when there are no job mails yet, and when nothing matches', async () => {
    conversations = [];
    show();
    expect(await screen.findByText('No job mails yet')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('New only'));
    expect(await screen.findByText('No job mails match this view')).toBeInTheDocument();
  });
});

describe('Gmail tab', () => {
  it('lists the inbox read live and opens job mails with their job view', async () => {
    inbox[''] = {
      items: [
        thread({ unread: true }),
        thread({
          threadId: 'thread-1',
          subject: 'Take-home assignment',
          from: 'Hiring Team <jobs@globex.example>',
          messageCount: 2,
          conversationKey: 'thread-1',
        }),
      ],
      nextPageToken: null,
    };
    show('/mails?tab=gmail');
    // The whole row opens the mail; its link is the subject.
    const plain = await screen.findByRole('link', { name: /Security alert/ });
    expect(plain).toHaveAttribute('href', '/mails/gmail/gmail-1');
    const plainRow = plain.closest('[role="row"]')!;
    expect(plainRow).toHaveTextContent("If this wasn't you");
    expect(plainRow).not.toHaveTextContent('Job mail');
    const job = screen.getByRole('link', { name: /Take-home assignment/ });
    expect(job).toHaveAttribute('href', '/mails/thread-1');
    const jobRow = job.closest('[role="row"]')!;
    expect(jobRow).toHaveTextContent('Hiring Team 2');
    expect(jobRow).toHaveTextContent('Job mail');
    expect(screen.getByText('you@gmail.com')).toBeInTheDocument();
    expect(screen.getByText(/Nothing shown here is stored/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Search')).not.toBeInTheDocument();
  });

  it('pages Older and Newer with Gmail tokens', async () => {
    inbox[''] = { items: [thread()], nextPageToken: 'page-2' };
    inbox['page-2'] = {
      items: [thread({ threadId: 'gmail-2', subject: 'Your October bill' })],
      nextPageToken: null,
    };
    show('/mails?tab=gmail');
    await screen.findByRole('link', { name: /Security alert/ });
    expect(screen.getByRole('button', { name: 'Newer' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Older' }));
    expect(await screen.findByRole('link', { name: /Your October bill/ })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(
      '/api/mailbox/threads?pageToken=page-2',
      expect.anything(),
      expect.any(Number),
    );
    expect(screen.getByRole('button', { name: 'Older' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Newer' }));
    expect(await screen.findByRole('link', { name: /Security alert/ })).toBeInTheDocument();
  });

  it('sends the user to Gmail Sync when Gmail is not connected, and offers a retry when Gmail is down', async () => {
    const failure = vi.fn<() => ApiError>(
      () =>
        new ApiError('Connect Gmail to read your mail here.', 'http', 409, 'GMAIL_NOT_CONNECTED'),
    );
    get.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/mailbox/threads')) throw failure();
      return page(conversations);
    });
    show('/mails?tab=gmail');
    expect(await screen.findByText('Connect Gmail to read your mail here.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Gmail Sync' })).toHaveAttribute('href', '/gmail');
    cleanup();

    failure.mockReturnValue(
      new ApiError(
        'Gmail could not be read right now. Try again.',
        'http',
        502,
        'GMAIL_UNAVAILABLE',
      ),
    );
    show('/mails?tab=gmail');
    expect(await screen.findByText(/Gmail could not be read right now/)).toBeInTheDocument();
    failure.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(failure).toHaveBeenCalled());
  });
});
