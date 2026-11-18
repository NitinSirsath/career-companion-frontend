// @vitest-environment jsdom
/**
 * Messages from the Admin page (owner, 18 Nov 2026, approved mock `OWNER-MESSAGES-mock/`): the
 * notice at the top of the app, closing it, and sending from the Admin page.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';
import { AdminMessages } from '../components/admin/AdminMessages';
import { OwnerMessages } from '../components/messages/OwnerMessages';
import type { AdminAccount } from '../contracts/admin';
import type { AdminMessagesResponse, MyMessagesResponse } from '../contracts/messages';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  api: { get: vi.fn(), post: vi.fn() },
}));

const NOW = new Date().toISOString();
const ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

let mine: MyMessagesResponse;
let sent: AdminMessagesResponse;

function wrap(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

beforeEach(() => {
  mine = { messages: [{ id: ID, text: 'Down tonight from 11 PM.', sentAt: NOW }] };
  sent = { messages: [], alertDevices: { [USER_ID]: 2, other: 1 } };
  vi.mocked(api.get).mockImplementation(async (url: string) =>
    url === '/api/messages' ? mine : sent,
  );
  vi.mocked(api.post).mockResolvedValue({ dismissed: true });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('the notice', () => {
  it('shows the message and closes it at once', async () => {
    wrap(<OwnerMessages />);
    const notice = await screen.findByRole('region', { name: 'Messages from NorthList' });
    expect(notice).toHaveTextContent('Message from NorthList');
    expect(notice).toHaveTextContent('Down tonight from 11 PM.');
    fireEvent.click(within(notice).getByRole('button', { name: 'Close message' }));
    await waitFor(() =>
      expect(screen.queryByText('Down tonight from 11 PM.')).not.toBeInTheDocument(),
    );
    expect(api.post).toHaveBeenCalledWith(`/api/messages/${ID}/dismiss`);
  });

  it('shows nothing when there is no message', async () => {
    mine = { messages: [] };
    wrap(<OwnerMessages />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/messages', expect.anything()));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});

describe('sending from the Admin page', () => {
  const account = { id: USER_ID, email: 'priya@example.com' } as AdminAccount;

  it('needs text, sends to everyone by default, and says how many devices have alerts on', async () => {
    vi.mocked(api.post).mockResolvedValue({
      message: {
        id: ID,
        text: 'Hello all',
        toEmail: null,
        sentAt: NOW,
        alertsSent: null,
        removedAt: null,
      },
    });
    wrap(<AdminMessages accounts={[account]} />);
    expect(await screen.findByText(/3 devices with alerts on/)).toBeInTheDocument();
    const send = screen.getByRole('button', { name: 'Send' });
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: ' Hello all ' } });
    fireEvent.click(send);
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/api/admin/messages', {
        text: 'Hello all',
        to: 'EVERYONE',
        alsoAlert: false,
      }),
    );
    await waitFor(() => expect(screen.getByLabelText('Message')).toHaveValue(''));
  });

  it('lists what was sent, with Remove, and marks a removed one', async () => {
    sent = {
      alertDevices: {},
      messages: [
        { id: ID, text: 'Live one', toEmail: null, sentAt: NOW, alertsSent: 4, removedAt: null },
        {
          id: USER_ID,
          text: 'Old one',
          toEmail: 'priya@example.com',
          sentAt: NOW,
          alertsSent: null,
          removedAt: NOW,
        },
      ],
    };
    wrap(<AdminMessages accounts={[account]} />);
    const list = await screen.findByRole('list', { name: 'Sent messages' });
    expect(list).toHaveTextContent('To everyone · Alert sent to 4 devices');
    expect(list).toHaveTextContent('To priya@example.com');
    expect(within(list).getAllByRole('button', { name: 'Remove' })).toHaveLength(1);
    expect(within(list).getByText('Removed')).toBeInTheDocument();
    expect(screen.getByText(/no devices with alerts on/)).toBeInTheDocument();
  });
});
