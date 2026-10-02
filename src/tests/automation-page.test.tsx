// @vitest-environment jsdom
// MCP-07: the Automation page (integration tokens) and its navigation (ADR-0002 decision 10).
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError, api } from '../api/client';
import type { IntegrationToken } from '../contracts/integrationToken';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: {
      getGmailStatus: vi.fn(),
      listIntegrationTokens: vi.fn(),
      createIntegrationToken: vi.fn(),
      revokeIntegrationToken: vi.fn(),
    },
  };
});

import { routeTree } from '../routeTree.gen';

const PLAINTEXT = `ccmcp_${'S'.repeat(20)}SENTINEL${'x'.repeat(15)}`;
const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();
const token = (overrides: Partial<IntegrationToken> = {}): IntegrationToken => ({
  id: 't1',
  name: 'Laptop',
  displayPrefix: 'ccmcp_abcdef',
  scope: 'submissions:write',
  status: 'active',
  createdAt: iso(-10),
  expiresAt: iso(80),
  lastUsedAt: null,
  revokedAt: null,
  ...overrides,
});
const page = <T,>(items: T[]) => ({ items, metadata: { limit: 20, offset: 0, nextOffset: null } });

let queryClient: QueryClient;
let storageWrites: string[];

function renderPage(path = '/automation') {
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }), context: { user: { id: 'u', email: 't@test.local', name: 'T' } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

/** Everything the browser keeps: query data, mutation variables, storage writes, the URL. */
const browserState = () =>
  JSON.stringify([
    queryClient.getQueryCache().getAll().map((q) => q.state.data),
    queryClient.getMutationCache().getAll().map((m) => [m.state.variables, m.state.data]),
    storageWrites,
    window.location.href,
  ]);

async function createToken(name = 'Work laptop', days?: string) {
  fireEvent.change(await screen.findByLabelText('Name'), { target: { value: name } });
  if (days) fireEvent.change(screen.getByLabelText('Expires after'), { target: { value: days } });
  fireEvent.click(screen.getByRole('button', { name: 'Create token' }));
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(api.getGmailStatus).mockResolvedValue({ connected: false } as never);
  vi.mocked(api.listIntegrationTokens).mockResolvedValue(page([]));
  storageWrites = [];
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key: string, value: string) {
    storageWrites.push(`${key}=${value}`);
  });
});
afterEach(() => vi.restoreAllMocks());

describe('navigation', () => {
  it('links to the Automation page next to AI Provider, on desktop and mobile', async () => {
    renderPage('/automation');
    expect(await screen.findByRole('heading', { name: 'Automation' })).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: /Automation/ });
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/automation', '/automation']);
    expect(screen.getByRole('link', { name: 'AI Provider' })).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/mcp`)).toBeInTheDocument();
  });
});

describe('creating a token', () => {
  it('shows the plaintext once with a copy button and a warning, and keeps it out of every cache', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    vi.mocked(api.createIntegrationToken).mockResolvedValue({ integrationToken: token({ name: 'Work laptop' }), plaintextToken: PLAINTEXT });
    renderPage();
    await createToken('  Work laptop ', '30');

    const shown = (await screen.findByLabelText('New token')) as HTMLInputElement;
    expect(api.createIntegrationToken).toHaveBeenCalledWith({ name: 'Work laptop', expiresInDays: 30 });
    expect(shown.value).toBe(PLAINTEXT);
    expect(shown).toHaveAttribute('readonly');
    expect(screen.getByText(/It will not be shown again/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copy token' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(PLAINTEXT));
    expect(await screen.findByText('Copied.')).toBeInTheDocument();
    expect(browserState()).not.toContain('SENTINEL');

    fireEvent.click(screen.getByRole('button', { name: 'Done, I saved it' }));
    expect(screen.queryByLabelText('New token')).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain('SENTINEL');
    expect(browserState()).not.toContain('SENTINEL');
    await waitFor(() => expect(api.listIntegrationTokens).toHaveBeenCalledTimes(2)); // list refreshed after create
  });

  it('drops the plaintext when the page unmounts', async () => {
    vi.mocked(api.createIntegrationToken).mockResolvedValue({ integrationToken: token(), plaintextToken: PLAINTEXT });
    const view = renderPage();
    await createToken();
    await screen.findByLabelText('New token');
    view.unmount();
    renderPage();
    await screen.findByLabelText('Name');
    expect(document.body.innerHTML).not.toContain('SENTINEL');
    expect(browserState()).not.toContain('SENTINEL');
  });

  it('asks for a name before calling the API', async () => {
    renderPage();
    await createToken('   ');
    expect(await screen.findByRole('alert')).toHaveTextContent('Give the token a name');
    expect(api.createIntegrationToken).not.toHaveBeenCalled();
  });

  it('shows a definitive refusal such as the active-token limit', async () => {
    vi.mocked(api.createIntegrationToken).mockRejectedValue(
      new ApiError('You can have at most 5 active tokens. Revoke one first.', 'http', 409, 'TOKEN_LIMIT_REACHED'),
    );
    renderPage();
    await createToken();
    expect(await screen.findByRole('alert')).toHaveTextContent('at most 5 active tokens');
    expect(screen.getByRole('button', { name: 'Create token' })).toBeEnabled();
  });

  it('an uncertain outcome refreshes the list and never resubmits automatically', async () => {
    vi.mocked(api.createIntegrationToken).mockRejectedValue(new ApiError('The request timed out.', 'timeout'));
    renderPage();
    await createToken();
    expect(await screen.findByText('Token creation outcome unknown')).toBeInTheDocument();
    expect(screen.getByText(/If a new token appears there, revoke it/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create token' })).toBeDisabled();
    await waitFor(() => expect(api.listIntegrationTokens).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'I checked the list' }));
    expect(screen.getByRole('button', { name: 'Create token' })).toBeEnabled();
    expect(api.createIntegrationToken).toHaveBeenCalledTimes(1);
  });
});

describe('token list', () => {
  it('shows name, prefix, status, last use and expiry, and warns in the last 14 days', async () => {
    vi.mocked(api.listIntegrationTokens).mockResolvedValue(
      page([
        token({ id: 'soon', name: 'Soon', expiresAt: iso(5.5), lastUsedAt: iso(-1) }),
        token({ id: 'later', name: 'Later', expiresAt: iso(60) }),
        token({ id: 'old', name: 'Old', status: 'expired', expiresAt: iso(-2) }),
        token({ id: 'gone', name: 'Gone', status: 'revoked', revokedAt: iso(-3) }),
      ]),
    );
    renderPage();
    const soon = (await screen.findByText('Soon')).closest('li')!;
    expect(within(soon).getByText('Active')).toBeInTheDocument();
    expect(within(soon).getByText(/ccmcp_abcdef…/)).toBeInTheDocument();
    expect(within(soon).getByText(/Last used/)).toBeInTheDocument();
    expect(within(soon).getByText(/Expires in [56] days/)).toBeInTheDocument();
    const later = screen.getByText('Later').closest('li')!;
    expect(within(later).queryByText(/Expires in/)).not.toBeInTheDocument();
    expect(within(later).getByText(/Never used/)).toBeInTheDocument();
    for (const name of ['Old', 'Gone']) {
      const row = screen.getByText(name).closest('li')!;
      expect(within(row).queryByRole('button', { name: /Revoke/ })).not.toBeInTheDocument();
    }
    expect(within(screen.getByText('Old').closest('li')!).getByText('Expired')).toBeInTheDocument();
    expect(within(screen.getByText('Gone').closest('li')!).getByText('Revoked')).toBeInTheDocument();
  });

  it('revokes after a confirmation and refreshes the list', async () => {
    vi.mocked(api.listIntegrationTokens).mockResolvedValue(page([token()]));
    vi.mocked(api.revokeIntegrationToken).mockResolvedValue(token({ status: 'revoked', revokedAt: iso(0) }));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke Laptop' }));
    expect(api.revokeIntegrationToken).not.toHaveBeenCalled();
    expect(screen.getByText(/stops syncing at once/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Revoke now' }));
    await waitFor(() => expect(api.revokeIntegrationToken).toHaveBeenCalledWith('t1'));
    await waitFor(() => expect(api.listIntegrationTokens).toHaveBeenCalledTimes(2));
  });

  it('cancelling a revoke does nothing', async () => {
    vi.mocked(api.listIntegrationTokens).mockResolvedValue(page([token()]));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke Laptop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(api.revokeIntegrationToken).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Revoke Laptop' })).toBeInTheDocument();
  });
});
