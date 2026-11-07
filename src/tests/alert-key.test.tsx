// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { api } from '../api/client';
import { alertKeyKey, useAlertKey } from '../api/alerts';

const KEY =
  'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';

function KeyAnswer() {
  const key = useAlertKey();
  if (!key.data) return null;
  return <p>{key.data.available ? 'keys' : 'no keys'}</p>;
}

/** Opens the page with the answer the offline copy brought back. */
function openWithSavedAnswer() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(alertKeyKey, { available: false, publicKey: null });
  render(
    <QueryClientProvider client={client}>
      <KeyAnswer />
    </QueryClientProvider>,
  );
}

describe('the alert key', () => {
  beforeEach(() => {
    vi.spyOn(api, 'get').mockResolvedValue({ available: true, publicKey: KEY });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    onlineManager.setOnline(true);
  });

  it('is asked again when the page opens, so a saved "no keys" answer does not stay', async () => {
    openWithSavedAnswer();
    expect(await screen.findByText('keys')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('offline, keeps the saved answer and asks nothing', async () => {
    onlineManager.setOnline(false);
    openWithSavedAnswer();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByText('no keys')).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });
});
