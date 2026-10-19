// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  api: {
    get: vi.fn(),
    post: vi.fn(),
    getGmailStatus: vi.fn(),
    getAISettings: vi.fn(),
    triggerSync: vi.fn(),
  },
}));

import { ApiError, api } from '../api/client';
import type {
  ListSandboxThreadsResponse,
  SandboxMailResult,
  SandboxMessage,
  SandboxThread,
  SandboxThreadDetail,
} from '../contracts/sandbox';
import {
  jobLine,
  mailStateDetail,
  sandboxProblem,
  sandboxRecipients,
  splitQuote,
  syncLine,
  threadMark,
} from '../lib/sandbox';
import { resetProcessingRefresh } from '../lib/processingRefresh';
import { routeTree } from '../routeTree.gen';

const PRIYA = 'Priya Raman <priya.raman@northwind.example>';
const THREAD = '13caf40a1e0fa8a8';
const get = vi.mocked(api.get);
const post = vi.mocked(api.post);
const modeFetch = vi.fn<typeof fetch>();

const result = (
  state: SandboxMailResult['state'],
  extra: Partial<SandboxMailResult> = {},
): SandboxMailResult => ({ state, failure: null, aiStatus: null, job: null, ...extra });
const job: NonNullable<SandboxMailResult['job']> = {
  category: 'RECRUITER',
  company: 'Northwind Robotics',
  role: 'Senior Platform Engineer',
  requestedAction: 'Reply with a time for a call',
  conversationKey: THREAD,
  application: {
    id: '22222222-2222-4222-8222-222222222222',
    companyName: 'Northwind Robotics',
    jobTitle: 'Senior Platform Engineer',
  },
};
const row = (overrides: Partial<SandboxThread> = {}): SandboxThread => ({
  threadId: THREAD,
  subject: 'Opportunity at Northwind Robotics',
  party: PRIYA,
  snippet: 'Hi Alex, would you have 20 minutes this week?',
  date: '2026-10-12T10:02:00.000Z',
  messageCount: 1,
  notSynced: 0,
  state: 'JOB_MAIL',
  ...overrides,
});
const message = (overrides: Partial<SandboxMessage> = {}): SandboxMessage => ({
  id: THREAD,
  from: PRIYA,
  to: 'Alex Tester <alex@test.local>',
  cc: null,
  date: '2026-10-12T10:02:00.000Z',
  sentByUser: false,
  text: 'Hi Alex,\n\nWould you have 20 minutes this week?',
  result: result('JOB_MAIL', { job }),
  ...overrides,
});
const mine = message({
  id: '338080a43da177cd',
  from: 'Alex Tester <alex@test.local>',
  to: PRIYA,
  date: '2026-10-12T10:20:00.000Z',
  sentByUser: true,
  text: 'Thursday at 3 pm works.\n\nOn Mon, 12 Oct 2026 10:02:00 GMT, Priya Raman <priya.raman@northwind.example> wrote:\n> Hi Alex,\n> \n> Would you have 20 minutes this week?',
  result: result('REPLY_RECORDED'),
});

let inbox: ListSandboxThreadsResponse;
let sent: ListSandboxThreadsResponse;
let thread: SandboxThreadDetail | ApiError;

const list = (items: SandboxThread[], notSyncedTotal = 0): ListSandboxThreadsResponse => ({
  mailbox: 'alex@test.local',
  items,
  nextPageToken: null,
  notSyncedTotal,
  counts: { inbox: 2, sent: 1 },
});

function show(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { user: { id: 'u', email: 'alex@test.local', name: 'Alex' } },
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}
const mode = (value: 'dev' | 'prod') =>
  modeFetch.mockImplementation(async () => new Response(JSON.stringify({ mode: value })));
const sandboxCalls = () =>
  [...get.mock.calls, ...post.mock.calls].filter(([path]) => path.startsWith('/api/sandbox'));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', modeFetch);
  mode('dev');
  inbox = list([row()]);
  sent = list([row({ snippet: 'Thursday at 3 pm works.', state: 'REPLY_RECORDED' })]);
  thread = {
    threadId: THREAD,
    subject: 'Opportunity at Northwind Robotics',
    party: PRIYA,
    messages: [message(), mine],
  };
  get.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/sandbox/threads?folder=sent')) return sent;
    if (path.startsWith('/api/sandbox/threads?')) return inbox;
    if (path.startsWith('/api/sandbox/threads/')) {
      if (thread instanceof ApiError) throw thread;
      return thread;
    }
    if (path === '/api/sandbox/senders') return { senders: [PRIYA, 'hr@initech.example'] };
    throw new ApiError('Not found', 'http', 404, 'NOT_FOUND');
  });
  post.mockResolvedValue({ id: 'aaaaaaaaaaaaaaaa', threadId: THREAD });
  vi.mocked(api.getGmailStatus).mockResolvedValue({
    connected: true,
    gmailEmail: 'alex@test.local',
    status: 'CONNECTED',
    syncStatus: 'IDLE',
    lastSyncedAt: null,
    // The sandbox mailbox can always send.
    canSend: true,
  });
  vi.mocked(api.getAISettings).mockRejectedValue(new ApiError('n/a', 'http', 404));
  vi.mocked(api.triggerSync).mockResolvedValue({ accepted: true } as never);
});
afterEach(() => {
  cleanup();
  resetProcessingRefresh();
  vi.unstubAllGlobals();
});

describe('sandbox wording', () => {
  it('marks a conversation by its unsynced mail first', () => {
    expect(threadMark({ notSynced: 1, state: 'JOB_MAIL' })).toEqual({
      label: '1 not synced',
      color: 'yellow',
    });
    expect(threadMark({ notSynced: 1, state: 'NOT_SYNCED' }).label).toBe('Not synced yet');
    expect(threadMark({ notSynced: 0, state: 'JOB_MAIL' })).toEqual({
      label: 'Job mail',
      color: 'green',
    });
    expect(threadMark({ notSynced: 0, state: 'AI_KEY_MISSING' })).toEqual({
      label: 'Not read: AI key is not set up',
      color: 'red',
    });
  });

  it('says when the app last synced and how much mail waits', () => {
    expect(syncLine(null, 2)).toBe('Never synced · 2 mails not synced');
    expect(syncLine('2020-03-04T10:00:00.000Z', 1)).toMatch(
      /^Last sync .+2020.+ · 1 mail not synced$/,
    );
    expect(syncLine(new Date('2020-03-04T10:00:00.000Z'), 0)).toMatch(/ · all mails synced$/);
  });

  it('says who a sandbox mail went to, with the people in Cc', () => {
    const cc = 'Daniel Okafor <daniel.okafor@northwind.example>, lena@northwind.example';
    expect(sandboxRecipients(message())).toBe('to me');
    expect(sandboxRecipients(message({ cc }))).toBe(
      'to me · cc Daniel Okafor, lena@northwind.example',
    );
    expect(sandboxRecipients(message({ sentByUser: true, to: PRIYA, cc }))).toBe(
      'to Priya Raman · cc Daniel Okafor, lena@northwind.example',
    );
  });

  it('explains every state but a job mail, whose details say it all', () => {
    expect(mailStateDetail(result('NOT_SYNCED'))).toMatch(/Sync to bring it in/);
    expect(mailStateDetail(result('WAITING_FOR_AI'))).toMatch(/has not read it yet/);
    expect(mailStateDetail(result('AI_KEY_MISSING'))).toMatch(/Add your AI key/);
    expect(mailStateDetail(result('AI_FAILED'))).toBe('Synced, but the AI could not read it.');
    expect(mailStateDetail(result('NOT_JOB_MAIL'))).toMatch(/not about a job/);
    expect(mailStateDetail(result('REPLY_RECORDED'))).toMatch(/you replied/);
    expect(mailStateDetail(result('JOB_MAIL', { job }))).toBeNull();
  });

  it('says why the AI could not read a mail in the same plain words as the Gmail Sync row', () => {
    const refused = result('AI_FAILED', {
      failure: 'TerminalAIError',
      aiStatus: {
        reason: 'INVALID_REQUEST',
        step: 'classification',
        provider: 'gemini',
        model: 'gemini-3.5-flash-lite',
        failure: null,
        attempts: 1,
        maxAttempts: 3,
        triedAt: [],
        nextTryAt: null,
        nextStep: 'CAREER_COMPANION',
        readNowTest: null,
      },
    });
    expect(mailStateDetail(refused)).toBe(
      'Synced, but the AI could not read it. Request refused. Career Companion sent a request Google refused. This is our problem, not yours.',
    );
    expect(mailStateDetail(refused)).not.toContain('TerminalAIError');
  });

  it('puts what the AI read on one line', () => {
    expect(jobLine(job)).toBe('Recruiter · Northwind Robotics · Senior Platform Engineer');
    expect(jobLine({ ...job, category: null, role: null })).toBe('Northwind Robotics');
  });

  it('splits a reply into its own text and the quoted mail', () => {
    expect(splitQuote(mine.text)).toEqual({
      own: 'Thursday at 3 pm works.',
      quoted:
        'On Mon, 12 Oct 2026 10:02:00 GMT, Priya Raman <priya.raman@northwind.example> wrote:\n> Hi Alex,\n> \n> Would you have 20 minutes this week?',
    });
    expect(splitQuote('Just text.\n\nOn Monday we wrote: nothing')).toEqual({
      own: 'Just text.\n\nOn Monday we wrote: nothing',
      quoted: null,
    });
  });

  it('names the cause when a sandbox action did not work', () => {
    expect(sandboxProblem(new ApiError('x', 'http', 400, 'GMAIL_NOT_CONNECTED'))).toMatch(
      /not connected/,
    );
    expect(sandboxProblem(new ApiError('x', 'http', 409, 'SYNC_IN_PROGRESS'))).toBe(
      'A sync is already running.',
    );
    expect(sandboxProblem(new ApiError('Network error.', 'network'))).toBe('Network error.');
    expect(sandboxProblem(new Error('boom'))).toBe('That did not work. Try again.');
  });
});

describe('prod mode', () => {
  it('has no sandbox page, no menu entry, and asks nothing of the sandbox API', async () => {
    mode('prod');
    show('/sandbox');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Mail sandbox/ })).not.toBeInTheDocument();
    cleanup();
    show('/sandbox/compose');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(sandboxCalls()).toEqual([]);
  });
});

describe('sandbox mailbox', () => {
  it('lists the inbox with what the app did, the sync line and the menu entry', async () => {
    inbox = list(
      [
        row({
          threadId: 'aaaaaaaaaaaaaaaa',
          subject: 'New mail',
          notSynced: 1,
          state: 'NOT_SYNCED',
        }),
        row({ messageCount: 3, notSynced: 1 }),
        row({ threadId: 'bbbbbbbbbbbbbbbb', party: 'hr@initech.example', state: 'NOT_JOB_MAIL' }),
      ],
      2,
    );
    show('/sandbox');
    const rows = await within(await screen.findByRole('region', { name: 'Inbox' })).findAllByRole(
      'link',
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Not synced yet');
    expect(rows[1]).toHaveTextContent('Priya Raman 3');
    expect(rows[1]).toHaveTextContent('1 not synced');
    expect(rows[1]).toHaveAttribute('href', `/sandbox/${THREAD}`);
    expect(rows[2]).toHaveTextContent('hr@initech.example');
    expect(rows[2]).toHaveTextContent('Not a job mail');
    expect(screen.getByText('Never synced · 2 mails not synced')).toBeInTheDocument();
    expect(screen.getByText(/Mailbox of alex@test.local/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inbox 2' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sent 1' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Mail sandbox/ }).length).toBeGreaterThan(0);
    expect(screen.queryByText('AI key is not set up')).not.toBeInTheDocument();
  });

  it("lists the user's replies under Sent", async () => {
    show('/sandbox?folder=sent');
    const rows = await within(await screen.findByRole('region', { name: 'Sent' })).findAllByRole(
      'link',
    );
    expect(rows[0]).toHaveTextContent('To: Priya Raman');
    expect(rows[0]).toHaveTextContent('Recorded as your reply');
  });

  it('says loudly when no AI key is set up', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue({
      access: { state: 'NOT_SET_UP' },
    } as Awaited<ReturnType<typeof api.getAISettings>>);
    inbox = list([row({ state: 'AI_KEY_MISSING' })]);
    show('/sandbox');
    const alert = await screen.findByText('AI key is not set up');
    expect(alert.closest('[role="alert"]')).toHaveTextContent('Mails are synced but not read.');
    expect(screen.getByRole('link', { name: 'Set up AI provider' })).toHaveAttribute('href', '/ai');
    expect(await screen.findByText('Not read: AI key is not set up')).toBeInTheDocument();
  });

  it('syncs with the same sync as the Gmail Sync page', async () => {
    show('/sandbox');
    fireEvent.click(await screen.findByRole('button', { name: 'Sync now' }));
    await waitFor(() => expect(api.triggerSync).toHaveBeenCalledTimes(1));
  });

  it('asks to connect the sandbox mailbox before a sync', async () => {
    vi.mocked(api.getGmailStatus).mockResolvedValue({
      connected: false,
      gmailEmail: null,
      status: null,
      syncStatus: null,
      lastSyncedAt: null,
    });
    show('/sandbox');
    expect(await screen.findByText(/not connected yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Connect it on the Gmail Sync page' })).toHaveAttribute(
      'href',
      '/gmail',
    );
  });

  it('resets the dev data only after a confirmation', async () => {
    post.mockResolvedValue({ deletedMessages: 3, deletedEmails: 2, deletedApplications: 1 });
    show('/sandbox');
    fireEvent.click(await screen.findByRole('button', { name: 'Reset dev data' }));
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete dev data' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/sandbox/reset', { confirm: 'RESET' }),
    );
  });
});

describe('sandbox conversation', () => {
  it('shows both sides with their text, the quoted mail, and what the app did', async () => {
    show(`/sandbox/${THREAD}`);
    const conversation = await screen.findByRole('region', { name: 'Conversation' });
    const mails = within(conversation).getAllByRole('article');
    expect(mails).toHaveLength(2);
    expect(mails[0]).toHaveTextContent('Priya Raman');
    expect(mails[0]).toHaveTextContent('to me');
    expect(mails[0]).toHaveTextContent('Would you have 20 minutes this week?');
    expect(mails[1]).toHaveTextContent('Your reply');
    expect(mails[1]).toHaveTextContent('to Priya Raman');
    expect(within(mails[1]).getByText('Thursday at 3 pm works.')).toBeInTheDocument();
    expect(mails[1].querySelector('blockquote')).toHaveTextContent('> Hi Alex,');
    expect(
      screen.getByText(/2 mails · 1 from you · with priya.raman@northwind.example/),
    ).toBeInTheDocument();

    const panel = within(screen.getByRole('complementary', { name: 'What the app did' }));
    expect(panel.getByText('Job mail')).toBeInTheDocument();
    expect(
      panel.getByText('Recruiter · Northwind Robotics · Senior Platform Engineer'),
    ).toBeInTheDocument();
    expect(panel.getByText('Reply with a time for a call')).toBeInTheDocument();
    expect(
      panel.getByRole('link', { name: 'Northwind Robotics, Senior Platform Engineer' }),
    ).toHaveAttribute('href', `/applications/${job.application?.id}`);
    expect(panel.getByText('Recorded as your reply')).toBeInTheDocument();
    expect(
      panel.getByRole('link', { name: 'Open this conversation on the Mails page' }),
    ).toHaveAttribute('href', `/mails/${THREAD}`);
  });

  it("writes the other person's next mail in the one box of the conversation", async () => {
    show(`/sandbox/${THREAD}`);
    const box = within(
      await screen.findByRole('form', { name: 'Next mail from the other person' }),
    );
    expect(box.getByText(`Next mail from ${PRIYA}`)).toBeInTheDocument();
    fireEvent.click(box.getByRole('button', { name: 'Send as Priya Raman' }));
    expect(await box.findByText('Write a message.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    fireEvent.change(box.getByLabelText('Their mail'), { target: { value: 'Thursday works.' } });
    fireEvent.click(box.getByRole('button', { name: 'Send as Priya Raman' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`/api/sandbox/threads/${THREAD}/replies`, {
        as: 'them',
        body: 'Thursday works.',
      }),
    );
    // Sent: the box stays, empty, for the mail after that.
    await waitFor(() => expect(box.getByLabelText('Their mail')).toHaveValue(''));
  });

  it('has no way to send a mail as the user, and leads to the Mails page for that', async () => {
    show(`/sandbox/${THREAD}`);
    await screen.findByRole('form', { name: 'Next mail from the other person' });
    expect(screen.getAllByRole('form')).toHaveLength(1);
    expect(screen.queryByLabelText('Your reply')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Write next mail/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'open this conversation on the Mails page' }),
    ).toHaveAttribute('href', `/mails/gmail/${THREAD}`);
  });

  it('says so when the conversation is not in the mailbox', async () => {
    thread = new ApiError('Conversation not found.', 'http', 404, 'NOT_FOUND');
    show(`/sandbox/${THREAD}`);
    expect(
      await screen.findByText('This conversation is not in your sandbox mailbox.'),
    ).toBeInTheDocument();
  });
});

describe('sandbox compose', () => {
  it('sends a new mail from a typed or picked address, always to the user', async () => {
    const router = show('/sandbox/compose');
    const form = within(await screen.findByRole('form', { name: 'New mail' }));
    expect(form.getByLabelText('To')).toHaveValue('Me <alex@test.local>');
    expect(form.getByLabelText('To')).toBeDisabled();
    await waitFor(() =>
      expect(
        [...document.querySelectorAll('#compose-senders option')].map((o) =>
          o.getAttribute('value'),
        ),
      ).toEqual([PRIYA, 'hr@initech.example']),
    );
    expect(form.queryByLabelText(/category/i)).not.toBeInTheDocument();

    fireEvent.change(form.getByLabelText('From'), { target: { value: 'Dana Lee' } });
    fireEvent.click(form.getByRole('button', { name: 'Send' }));
    expect(
      await form.findByText('Enter a mail address, with or without a name.'),
    ).toBeInTheDocument();
    expect(form.getByText('Write a message.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    fireEvent.change(form.getByLabelText('From'), {
      target: { value: 'Dana Lee <dana.lee@globex.example>' },
    });
    fireEvent.change(form.getByLabelText('Subject'), { target: { value: 'Staff Engineer role' } });
    fireEvent.change(form.getByLabelText('Message'), {
      target: { value: 'Hi Alex,\n\nInterested?' },
    });
    fireEvent.click(form.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/sandbox/messages', {
        from: 'Dana Lee <dana.lee@globex.example>',
        subject: 'Staff Engineer role',
        body: 'Hi Alex,\n\nInterested?',
      }),
    );
    // Back to the inbox, where the new mail waits for a sync.
    await waitFor(() => expect(router.state.location.pathname).toBe('/sandbox'));
  });

  it('puts other people on a new mail with the Cc line, so a reply to all can be tried', async () => {
    show('/sandbox/compose');
    const form = within(await screen.findByRole('form', { name: 'New mail' }));
    const cc = 'Daniel Okafor <daniel.okafor@northwind.example>, lena@northwind.example';
    fireEvent.change(form.getByLabelText('From'), { target: { value: PRIYA } });
    fireEvent.change(form.getByLabelText('Message'), { target: { value: 'Hi all' } });
    fireEvent.change(form.getByLabelText(/^Cc/), { target: { value: 'the hiring team' } });
    fireEvent.click(form.getByRole('button', { name: 'Send' }));
    expect(
      await form.findByText('Enter mail addresses with commas between them, at most 10.'),
    ).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    fireEvent.change(form.getByLabelText(/^Cc/), { target: { value: cc } });
    fireEvent.click(form.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/sandbox/messages', {
        from: PRIYA,
        cc,
        subject: '',
        body: 'Hi all',
      }),
    );
  });
});

describe('mail details in dev mode', () => {
  it('replies into the mail sandbox, says so, and links there instead of to Gmail', async () => {
    get.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/mailbox/threads/'))
        return {
          threadId: THREAD,
          subject: 'Opportunity',
          messages: [
            {
              id: THREAD,
              from: PRIYA,
              to: 'alex@test.local',
              cc: null,
              date: '2026-10-12T10:02:00.000Z',
              subject: 'Opportunity',
              labels: ['Inbox'],
              sentByUser: false,
              text: 'Hi Alex',
              html: null,
              truncated: false,
              attachments: [],
            },
          ],
          replyTo: PRIYA,
        };
      throw new ApiError('Not found', 'http', 404, 'NOT_FOUND');
    });
    post.mockResolvedValue({ id: 'sent-1', threadId: THREAD, sentAt: '2026-10-12T10:20:00.000Z' });
    show(`/mails/gmail/${THREAD}`);
    const form = within(await screen.findByRole('form', { name: 'Reply' }));
    expect(
      form.getByText(/^Dev mode: the reply goes to the mail sandbox\. No real mail is sent\./),
    ).toBeInTheDocument();
    expect(form.getByRole('link', { name: 'Open in the mail sandbox' })).toHaveAttribute(
      'href',
      `/sandbox/${THREAD}`,
    );
    expect(screen.queryByRole('link', { name: /in Gmail$/ })).not.toBeInTheDocument();

    // The same call as in prod: the backend sends it through the sandbox.
    fireEvent.change(form.getByLabelText('Your reply'), { target: { value: 'Thursday works.' } });
    fireEvent.click(form.getByRole('button', { name: 'Send reply' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        `/api/mailbox/threads/${THREAD}/replies`,
        { replyId: expect.any(String), text: 'Thursday works.' },
        undefined,
        60_000,
      ),
    );
  });
});
