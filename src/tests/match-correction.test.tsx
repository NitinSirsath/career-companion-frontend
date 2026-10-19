// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError, api } from '../api/client';
import { MatchCorrectionDialog } from '../components/MatchCorrectionDialog';
import { makeApplication } from './fixtures';
import { pressOption } from './choose';
vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  api: { listApplications: vi.fn(), correctEmailMatch: vi.fn() },
}));
const a = '00000000-0000-4000-8000-000000000001';
const b = '00000000-0000-4000-8000-000000000002';
const emailId = '00000000-0000-4000-8000-000000000003';
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.listApplications).mockResolvedValue({
    items: [
      makeApplication({ id: a, companyName: 'Current' }),
      makeApplication({ id: b, companyName: 'Target' }),
    ],
    metadata: { offset: 0, limit: 20, nextOffset: null },
  });
  vi.mocked(api.correctEmailMatch).mockResolvedValue({
    email: {
      id: emailId,
      matchState: 'MATCHED',
      matchConfirmedBy: 'USER_CONFIRMED',
      applicationId: b,
    },
    affectedApplicationIds: [a, b],
  });
});
afterEach(cleanup);
const openList = async () =>
  fireEvent.click(await screen.findByRole('button', { name: 'Open Application' }));
function show(matchState: 'MATCHED' | 'IGNORED' = 'MATCHED') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <MatchCorrectionDialog
        emailId={emailId}
        applicationId={matchState === 'MATCHED' ? a : null}
        matchState={matchState}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Change link' }));
  return invalidate;
}
it.each([b, 'unlink'])('sends one explicit move/unlink with expected state: %s', async (target) => {
  const invalidate = show();
  await openList();
  await screen.findByRole('option', { name: /Target/ });
  expect(screen.queryByRole('option', { name: /Current/ })).not.toBeInTheDocument();
  pressOption(
    screen.getByRole('option', {
      name: target === 'unlink' ? 'Not linked to any application' : /Target/,
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save link' }));
  await waitFor(() =>
    expect(api.correctEmailMatch).toHaveBeenCalledWith(emailId, {
      applicationId: target === 'unlink' ? null : target,
      expectedApplicationId: a,
      expectedMatchState: 'MATCHED',
    }),
  );
  expect(api.correctEmailMatch).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['application-events'] });
});
it.each([
  new ApiError('conflict', 'http', 409, 'MATCH_CONFLICT'),
  new ApiError('lost response', 'timeout'),
  new ApiError('malformed success', 'contract'),
])('refetches a conflict or uncertain response without resending', async (error) => {
  vi.mocked(api.correctEmailMatch).mockRejectedValue(error);
  const invalidate = show();
  await openList();
  pressOption(await screen.findByRole('option', { name: /Target/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Save link' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/changed|could not be confirmed/);
  expect(screen.getByRole('button', { name: 'Save link' })).toBeDisabled();
  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['gmailMessages'] }));
  expect(api.correctEmailMatch).toHaveBeenCalledTimes(1);
});
it('paginates owned choices and does not offer unlink for ignored mail', async () => {
  vi.mocked(api.listApplications).mockResolvedValueOnce({
    items: [],
    metadata: { offset: 0, limit: 20, nextOffset: 20 },
  });
  show('IGNORED');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());
  await openList();
  expect(await screen.findByText('No application matches')).toBeInTheDocument();
  expect(
    screen.queryByRole('option', { name: 'Not linked to any application' }),
  ).not.toBeInTheDocument();
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await openList();
  await screen.findByRole('option', { name: /Target/ });
  expect(api.listApplications).toHaveBeenLastCalledWith(
    { offset: 20, limit: 20 },
    expect.anything(),
  );
});
