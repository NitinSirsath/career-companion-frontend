// @vitest-environment jsdom
/**
 * The Gmail sync page as a summary (owner, 17 Nov 2026): what the app has read in 30 days, a
 * yellow line when the AI could not read some mails, and how mail is read, in words that match
 * the privacy pages.
 */
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';
import type { AIConnection } from '../contracts/ai';
import type { GmailSummaryResponse } from '../contracts/gmail';
import { aiReaderText } from '../lib/aiConnections';
import { FREE_AI_FACTS } from '../lib/freeAI';
import {
  chars,
  MAIL_LIMITS,
  mailReadingFacts,
  NOT_JOB_MAIL_KEPT_DAYS,
  WRITE_WITH_AI_NOTE,
} from '../lib/mailReading';
import { routeTree } from '../routeTree.gen';
import { makeAISettings } from './fixtures';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  api: {
    getGmailStatus: vi.fn(),
    getGmailSummary: vi.fn(),
    getMessages: vi.fn(),
    getAISettings: vi.fn(),
  },
}));

const summary = (overrides: Partial<GmailSummaryResponse> = {}): GmailSummaryResponse => ({
  days: 30,
  since: '2026-10-19T00:00:00.000Z',
  checked: 1248,
  jobMails: 37,
  notJobMails: 1205,
  waiting: 0,
  fakeOffers: 1,
  failed: 0,
  ...overrides,
});

const connection = (overrides: Partial<AIConnection>): AIConnection => ({
  provider: 'career-companion',
  active: true,
  state: 'READY',
  reason: null,
  modelId: null,
  failure: null,
  models: null,
  verified: true,
  lastCheckedAt: null,
  consentCurrent: true,
  ...overrides,
});
const ready = (connections: AIConnection[]) =>
  makeAISettings({
    configured: true,
    provider: connections[0]?.provider ?? null,
    access: { ...makeAISettings().access, state: 'READY', reason: null },
    connections,
  });

function show(path = '/gmail') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { user: { id: 'u', email: 'u@example.com', name: 'U' } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(api.getGmailStatus).mockResolvedValue({
    connected: true,
    gmailEmail: 'u@example.com',
    status: 'CONNECTED',
    syncStatus: 'IDLE',
    lastSyncedAt: null,
    canSend: true,
  });
  vi.mocked(api.getGmailSummary).mockResolvedValue(summary());
  vi.mocked(api.getAISettings).mockResolvedValue(ready([connection({})]));
  vi.mocked(api.getMessages).mockResolvedValue({
    items: [],
    metadata: { limit: 20, offset: 0, nextOffset: null },
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('What the app has read', () => {
  it('shows the four numbers of the last 30 days', async () => {
    show();
    const section = (await screen.findByRole('heading', { name: 'What the app has read' }))
      .parentElement!.parentElement!;
    expect(within(section).getByText('Last 30 days')).toBeInTheDocument();
    await within(section).findByText('1,248');
    for (const [label, value] of [
      ['Mails checked', '1,248'],
      ['Job mails', '37'],
      ['Not job mails', '1,205'],
      ['Fake offers caught', '1'],
    ])
      expect(within(section).getByText(label).parentElement).toHaveTextContent(value);
    expect(section).toHaveTextContent('Counted by the day each mail arrived.');
    expect(section).not.toHaveTextContent('waiting for the AI');
    expect(section).not.toHaveTextContent('could not be read');
  });

  it('says how many mails wait for the AI, only when some do', async () => {
    vi.mocked(api.getGmailSummary).mockResolvedValue(summary({ waiting: 6 }));
    show();
    expect(
      await screen.findByText(/6 mails are still waiting for the AI\. Counted by the day/),
    ).toBeInTheDocument();
  });

  it('shows the yellow line when the AI could not read some mails, with the way to them', async () => {
    vi.mocked(api.getGmailSummary).mockResolvedValue(summary({ failed: 2 }));
    show();
    const line = (await screen.findByText(/2 mails could not be read by the AI\./)).closest('p')!;
    expect(within(line).getByRole('link', { name: 'See them' })).toHaveAttribute(
      'href',
      '/gmail/mails',
    );
  });

  it('says so when the numbers do not load', async () => {
    vi.mocked(api.getGmailSummary).mockRejectedValue(new Error('down'));
    show();
    expect(await screen.findByText(/Could not load what the app has read/)).toBeInTheDocument();
  });
});

describe('How your mail is read', () => {
  it('lists the six facts, with the free AI as the reader', async () => {
    show();
    const section = (await screen.findByRole('heading', { name: 'How your mail is read' }))
      .parentElement!.parentElement!;
    for (const term of [
      'Gmail access',
      'Which mail',
      'To sort each mail',
      'Only for job mails',
      'What is kept',
      'Which AI reads it',
    ])
      expect(within(section).getByText(term)).toBeInTheDocument();
    expect(section).toHaveTextContent('It sends a mail only when you press Send on a reply.');
    expect(section).toHaveTextContent('NorthList free AI. OpenRouter');
    expect(section).toHaveTextContent(WRITE_WITH_AI_NOTE);
    expect(within(section).getByRole('link', { name: /Privacy policy/ })).toHaveAttribute(
      'href',
      'https://northlist.site/privacy.html',
    );
  });

  it('says the app only reads when the connection cannot send', () => {
    const access = mailReadingFacts({ canSend: false, reader: '' })[0];
    expect(access.text).toBe(
      'The app can only read your mail. It never changes, moves or deletes anything in Gmail.',
    );
  });

  it('names an own key, or that no AI is set up yet', () => {
    const ownKey = ready([
      connection({
        provider: 'openrouter',
        models: {
          fast: { id: 'openai/gpt-6-luna', source: 'RECOMMENDED' },
          detailed: { id: 'openai/gpt-6-luna', source: 'RECOMMENDED' },
        },
      }),
    ]);
    expect(aiReaderText(ownKey)).toMatch(
      /^OpenRouter, with your own key \(.+\)\. Your mail goes to your own account with that AI service, under its own terms\.$/,
    );
    expect(aiReaderText(makeAISettings())).toBe(
      'No AI is set up yet. New mails wait until you choose one on the AI providers page.',
    );
  });
});

describe('one home for each fact', () => {
  const policy = readFileSync(resolve(__dirname, '../../site/public/privacy.html'), 'utf8');
  const yourData = readFileSync(resolve(__dirname, '../../site/privacy/index.html'), 'utf8');
  const facts = mailReadingFacts({ canSend: true, reader: '' })
    .map((fact) => fact.text)
    .join(' ');

  it('uses the same limits on the page, in the free AI notices and on both privacy pages', () => {
    const sent = FREE_AI_FACTS.find((fact) => fact.term === 'What is sent')!.text;
    for (const limit of [MAIL_LIMITS.preview, MAIL_LIMITS.body]) {
      for (const text of [facts, sent, policy, yourData]) expect(text).toContain(chars(limit));
    }
    for (const text of [facts, policy, yourData]) {
      expect(text).toContain(chars(MAIL_LIMITS.reply));
      expect(text).toContain(`${NOT_JOB_MAIL_KEPT_DAYS} days`);
    }
  });

  it('names both Gmail permissions the privacy pages name', () => {
    for (const page of [policy, yourData]) {
      expect(page).toContain('gmail.readonly');
      expect(page).toContain('gmail.send');
    }
  });
});
