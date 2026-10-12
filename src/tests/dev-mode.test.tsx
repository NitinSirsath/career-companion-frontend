// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getAppMode } from '../api/appMode';
import { DevModeBanner } from '../components/devMode/DevModeBanner';
import { GmailLink } from '../components/ui/GmailLink';
import { gmailConnectionCopy } from '../lib/gmailConnection';

const modeFetch = vi.fn<typeof fetch>();

function renderWithQuery(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

function backendAnswers(body: unknown, status = 200) {
  modeFetch.mockImplementation(async () => new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
  vi.stubGlobal('fetch', modeFetch);
  backendAnswers({ mode: 'dev' });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  modeFetch.mockReset();
});

describe('app mode', () => {
  it('is what the backend says', async () => {
    expect(await getAppMode()).toBe('dev');
    expect(modeFetch).toHaveBeenCalledWith('/api/app-mode', { cache: 'no-store' });
    backendAnswers({ mode: 'prod' });
    expect(await getAppMode()).toBe('prod');
  });

  it('is prod whenever the backend gives no valid answer', async () => {
    backendAnswers({ mode: 'test' });
    expect(await getAppMode()).toBe('prod');
    backendAnswers({ error: { code: 'NOT_FOUND' } }, 404);
    expect(await getAppMode()).toBe('prod');
    modeFetch.mockImplementation(async () => new Response('not json', { status: 200 }));
    expect(await getAppMode()).toBe('prod');
    modeFetch.mockRejectedValue(new Error('offline'));
    expect(await getAppMode()).toBe('prod');
  });
});

describe('dev mode UI', () => {
  it('shows the DEV MODE banner in dev mode', async () => {
    renderWithQuery(<DevModeBanner />);
    expect(await screen.findByRole('status')).toHaveTextContent(/^DEV MODE · Gmail is the mail/);
  });

  it('shows no banner in prod mode', async () => {
    backendAnswers({ mode: 'prod' });
    const { container } = renderWithQuery(<DevModeBanner />);
    await waitFor(() => expect(modeFetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('offers a Gmail link in prod mode only: dev-mode mail is not in Gmail', async () => {
    backendAnswers({ mode: 'prod' });
    renderWithQuery(<GmailLink threadId="18c2f0a1b2c3d4e5" subject="Interview" />);
    expect(screen.getByRole('link', { name: /in Gmail$/ })).toBeInTheDocument();
    cleanup();

    backendAnswers({ mode: 'dev' });
    const { container } = renderWithQuery(
      <GmailLink threadId="18c2f0a1b2c3d4e5" subject="Interview" />,
    );
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

describe('Gmail connection wording', () => {
  it('names the sandbox mailbox in dev mode', () => {
    expect(gmailConnectionCopy(true, null)).toEqual({
      connect: 'Connect sandbox mailbox',
      notConnected:
        'Not connected. In dev mode your Gmail account is the mail sandbox: no Google account is used.',
      connectedNote: 'Sandbox mailbox.',
    });
  });

  it('keeps the Gmail wording in prod mode', () => {
    expect(gmailConnectionCopy(false, null)).toEqual({
      connect: 'Connect Gmail',
      notConnected: 'Gmail not connected',
      connectedNote: null,
    });
    expect(gmailConnectionCopy(false, 'REVOKED')).toEqual({
      connect: 'Reconnect Gmail',
      notConnected: 'Gmail access was revoked. Please reconnect.',
      connectedNote: null,
    });
  });
});
