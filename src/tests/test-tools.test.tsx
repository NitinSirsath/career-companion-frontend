// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('../api/client', () => ({
  api: { post: vi.fn(), createApplication: vi.fn(async () => ({ id: 'app-1' })) },
}));

import { api } from '../api/client';
import { TestEnvironmentBanner } from '../components/testTools/TestEnvironmentBanner';
import { TestInboxPanel } from '../components/testTools/TestInboxPanel';
import { GmailLink } from '../components/ui/GmailLink';

const statusFetch = vi.fn<typeof fetch>();
const post = vi.mocked(api.post);
const deliveries = () => post.mock.calls.filter(([path]) => path === '/api/test-tools/emails');

function renderWithQuery(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

function backendStatus(body: unknown, status = 200) {
  // A fresh Response per call: a body can be read only once, and reset refetches the status.
  statusFetch.mockImplementation(async () => new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
  vi.stubEnv('VITE_TEST_TOOLS', 'true');
  vi.stubGlobal('fetch', statusFetch);
  backendStatus({ enabled: true });
  post.mockReset();
  vi.mocked(api.createApplication).mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('test environment UI', () => {
  it('shows nothing in a normal build and sends no request', async () => {
    vi.stubEnv('VITE_TEST_TOOLS', 'false');
    const { container } = renderWithQuery(
      <>
        <TestEnvironmentBanner />
        <TestInboxPanel />
      </>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container).toBeEmptyDOMElement();
    expect(statusFetch).not.toHaveBeenCalled();
  });

  it('shows nothing when the backend has test tools off', async () => {
    backendStatus({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
    const { container } = renderWithQuery(<TestInboxPanel />);
    await waitFor(() => expect(statusFetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the TEST banner', async () => {
    renderWithQuery(<TestEnvironmentBanner />);
    expect(await screen.findByRole('status')).toHaveTextContent(/^TEST ENVIRONMENT$/);
  });

  it('offers no Fake AI emails', async () => {
    renderWithQuery(<TestInboxPanel />);
    const picker = await screen.findByLabelText('Ready-made email');
    expect(picker).not.toHaveTextContent(/fake ai/i);
  });

  it('fills a ready-made email and delivers it, then replies in the same thread', async () => {
    post.mockResolvedValue({ emailId: 'e1', threadId: 'sim-thread-aaaaaaaa' });
    renderWithQuery(<TestInboxPanel />);
    fireEvent.change(await screen.findByLabelText('Company'), { target: { value: 'Contoso' } });
    fireEvent.change(screen.getByLabelText('Ready-made email'), { target: { value: 'offer' } });
    expect(screen.getByLabelText('Subject')).toHaveValue('Your job offer from Contoso');

    fireEvent.click(screen.getByRole('button', { name: 'Deliver email' }));
    await waitFor(() => expect(deliveries()).toHaveLength(1));
    expect(deliveries()[0][1]).toEqual({
      subject: 'Your job offer from Contoso',
      sender: 'Priya Raman <priya.raman@contoso.example.com>',
      body: expect.stringContaining('Contoso'),
      label: 'CATEGORY_PRIMARY',
      threadId: undefined,
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Delivered');

    fireEvent.click(screen.getByLabelText('Reply in the same thread as the last test email'));
    fireEvent.click(screen.getByRole('button', { name: 'Deliver email' }));
    await waitFor(() => expect(deliveries()).toHaveLength(2));
    expect(deliveries()[1][1]).toMatchObject({ threadId: 'sim-thread-aaaaaaaa' });
  });

  it('does not deliver an email with an empty body', async () => {
    renderWithQuery(<TestInboxPanel />);
    fireEvent.change(await screen.findByLabelText('Body'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Deliver email' }));
    expect(await screen.findByText(/too small/i)).toBeInTheDocument();
    expect(deliveries()).toHaveLength(0);
  });

  it('runs a scenario: creates the application, then delivers each step in one thread', async () => {
    post.mockResolvedValue({ emailId: 'e1', threadId: 'sim-thread-bbbbbbbb' });
    renderWithQuery(<TestInboxPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start scenario' }));
    await waitFor(() =>
      expect(api.createApplication).toHaveBeenCalledWith({
        companyName: 'Northwind Robotics',
        jobTitle: 'Senior Platform Engineer',
      }),
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Deliver email 1 of 4: Application received' }),
    );
    await waitFor(() => expect(deliveries()).toHaveLength(1));
    expect(deliveries()[0][1]).toMatchObject({ threadId: undefined });

    fireEvent.click(
      await screen.findByRole('button', { name: 'Deliver email 2 of 4: Coding assessment' }),
    );
    await waitFor(() => expect(deliveries()).toHaveLength(2));
    expect(deliveries()[1][1]).toMatchObject({ threadId: 'sim-thread-bbbbbbbb' });
  });

  it('resets only after confirmation', async () => {
    post.mockResolvedValue({ deletedEmails: 2, deletedApplications: 1 });
    renderWithQuery(<TestInboxPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reset my test data' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(post).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Reset my test data' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete test data' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/test-tools/reset', { confirm: 'RESET' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Deleted 2 emails and 1 application.',
    );
  });

  it('never links a test email to Gmail', () => {
    const { container, rerender } = render(
      <GmailLink threadId="sim-thread-cccccccc" subject="Test" />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<GmailLink threadId="18c2f0a1b2c3d4e5" subject="Real" />);
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('18c2f0a1b2c3d4e5'),
    );
  });
});
