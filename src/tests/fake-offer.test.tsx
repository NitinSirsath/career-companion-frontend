// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

const SUBJECT = 'Congratulations! Offer of employment';
const REASON = 'It asks you to pay Rs 8,500 to confirm your joining.';
const SAFE_STEP = "Don't pay. Check this job on the company's own careers site.";
const ADVICE =
  "Real employers don't ask you to pay to get a job. Don't pay, and don't send bank or ID details. Check the job on the company's own careers site.";
const page = <T,>(items: T[]) => ({ items, metadata: { limit: 20, offset: 0, nextOffset: null } });

/** A fake offer as the server sends it: the reason, and the app's own safe next step. */
function fakeDetail(): ConversationDetail {
  const conversation = makeConversation({
    subject: SUBJECT,
    category: 'OFFER',
    fakeOfferWarning: REASON,
  });
  conversation.request = { ...conversation.request!, text: SAFE_STEP, deadline: null };
  return {
    conversation,
    mails: [
      makeConversationMail({
        category: 'OFFER',
        requestedAction: 'Pay Rs 8,500',
        fakeOfferWarning: 'Asks you to pay Rs 8,500 to join',
      }),
    ],
    sentAt: [],
    replyChoices: [],
  };
}

let detail: ConversationDetail;
let desktopWidth: number;

const setWidth = (width: number) =>
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });

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
  desktopWidth = window.innerWidth;
  detail = fakeDetail();
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path.startsWith('/api/conversations?')) return page([detail.conversation]);
    if (path.startsWith('/api/conversations/')) return detail;
    if (path.startsWith('/api/mailbox/threads/'))
      return {
        threadId: 'thread-1',
        subject: SUBJECT,
        messages: [makeMailMessage()],
        replyTo: 'Priya Nair <priya.nair@northwind.example>',
      };
    throw new ApiError('Not found', 'http', 404, 'NOT_FOUND');
  });
  vi.mocked(api.post).mockResolvedValue({ seen: true });
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
  setWidth(desktopWidth);
});

describe('a mail the AI thinks is a fake job offer', () => {
  it('keeps the mail and warns above it, with the reason, the advice and that the AI can be wrong', async () => {
    show('/mails/thread-1');
    const banner = (
      await screen.findByText('This looks like a fake job offer')
    ).closest<HTMLElement>('[role="status"]')!;
    const notice = within(banner);
    expect(notice.getByText(REASON)).toBeInTheDocument();
    expect(notice.getByText(ADVICE)).toBeInTheDocument();
    expect(notice.getByText(/It can be wrong\. The mail stays here/)).toBeInTheDocument();
    // The user decides: there is no way to hide the warning.
    expect(notice.queryByRole('button')).not.toBeInTheDocument();
    // It sits above the conversation, which is still shown.
    const article = await screen.findByRole('article');
    expect(banner.compareDocumentPosition(article) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('tags it in the header and gives the safe next step without "Needs action" or a due date', async () => {
    show('/mails/thread-1');
    const title = await screen.findByRole('heading', { name: SUBJECT });
    expect(within(title.closest('header')!).getByText('Probably fake')).toBeInTheDocument();

    const panel = within(screen.getByRole('complementary', { name: 'About this job mail' }));
    expect(panel.getByText(SAFE_STEP)).toBeInTheDocument();
    expect(panel.getByText('Probably fake')).toBeInTheDocument();
    expect(panel.queryByText('Needs action')).not.toBeInTheDocument();
    expect(panel.queryByText(/^Due /)).not.toBeInTheDocument();
    expect(panel.getByText(/Written by NorthList/)).toBeInTheDocument();
  });

  it("shows the AI's warning under the mail, and not the payment it asks for", async () => {
    show('/mails/thread-1');
    const mail = within(await screen.findByRole('article'));
    fireEvent.click(mail.getByRole('button', { name: /^AI read:/ }));
    expect(mail.getByText('Warning')).toBeInTheDocument();
    expect(mail.getByText('Asks you to pay Rs 8,500 to join')).toBeInTheDocument();
    expect(mail.queryByText('Asked for')).not.toBeInTheDocument();
    expect(mail.queryByText(/Pay Rs 8,500/)).not.toBeInTheDocument();
    // The safe step is the app's advice, so the mail is not marked as asking for it.
    expect(mail.queryByText('Asks you')).not.toBeInTheDocument();
  });

  it('lets the user link it by hand, but does not suggest a one-click application', async () => {
    show('/mails/thread-1');
    await screen.findByRole('article');
    const panel = within(screen.getByRole('complementary', { name: 'About this job mail' }));
    expect(panel.getByRole('button', { name: 'Create application' })).toBeInTheDocument();
    expect(panel.queryByText(/^One click\./)).not.toBeInTheDocument();
  });

  it('shows no warning for a mail the AI did not flag', async () => {
    detail = {
      conversation: makeConversation(),
      mails: [makeConversationMail()],
      sentAt: [],
      replyChoices: [],
    };
    show('/mails/thread-1');
    await screen.findByRole('article');
    expect(screen.queryByText('This looks like a fake job offer')).not.toBeInTheDocument();
    expect(screen.queryByText('Probably fake')).not.toBeInTheDocument();
    expect(screen.getByText('Needs action')).toBeInTheDocument();
    expect(within(screen.getByRole('article')).getByText('Asks you')).toBeInTheDocument();
    expect(screen.getByText(/^One click\./)).toBeInTheDocument();
  });
});

describe('a fake job offer in the Mails list', () => {
  it('tags the row by its type, and shows the next step without "Needs action"', async () => {
    show('/mails');
    const cells = within(
      (await screen.findByRole('link', { name: SUBJECT })).closest<HTMLElement>('[role="row"]')!,
    );
    expect(cells.getByText('Offer')).toBeInTheDocument();
    expect(cells.getByText('Probably fake')).toBeInTheDocument();
    expect(cells.getByText(SAFE_STEP)).toBeInTheDocument();
    expect(cells.queryByText('Needs action')).not.toBeInTheDocument();
  });

  it('tags the phone row too', async () => {
    setWidth(375);
    show('/mails');
    const phoneRow = within(
      await screen.findByRole('link', { name: `${SUBJECT}, from Priya Nair` }),
    );
    expect(phoneRow.getByText('Probably fake')).toBeInTheDocument();
    expect(phoneRow.getByText(SAFE_STEP)).toBeInTheDocument();
    expect(phoneRow.queryByText('Needs action')).not.toBeInTheDocument();
  });
});
