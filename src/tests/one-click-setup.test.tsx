// @vitest-environment jsdom
// One-click setup of NorthList Apply (owner, 23 Nov 2026): a setup code in "Open in …" links.
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';
import { AutomationSetup } from '../components/automation/AutomationSetup';
import { codeSetupPrompt, openAppLink } from '../lib/setupPrompt';

const SERVER = 'https://api.northlist.test';
const CODE = 'NL-7Q2X-K9PD-4MWT';

function openSetupTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AutomationSetup />
    </QueryClientProvider>,
  );
}

describe('the setup prompt with a setup code', () => {
  it('has the server and the code, and no token', () => {
    const prompt = codeSetupPrompt(SERVER, CODE);
    expect(prompt).toContain(`NorthList server: ${SERVER}`);
    expect(prompt).toContain(`Setup code: ${CODE} (works once, for 10 minutes)`);
    expect(prompt).toContain('Documents/NorthList Apply');
    expect(prompt).toContain('instructions/northlist_connect.md');
    expect(prompt).not.toContain('ccmcp_');
  });

  it('opens Codex and Claude Code with the prompt typed in; Antigravity has no link', () => {
    const prompt = 'Connect & go\nnow';
    expect(openAppLink('codex', prompt)).toBe(`codex://new?prompt=${encodeURIComponent(prompt)}`);
    expect(openAppLink('claude-code', prompt)).toBe(
      `claude-cli://open?q=${encodeURIComponent(prompt)}`,
    );
    expect(openAppLink('antigravity', prompt)).toBeNull();
  });
});

describe('Automation › Setup', () => {
  const assign = vi.fn();
  const write = vi.fn().mockResolvedValue(undefined);
  beforeEach(() => {
    vi.spyOn(api, 'getMcpConnection').mockResolvedValue({ serverAddress: SERVER });
    vi.spyOn(api, 'listIntegrationTokens').mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    } as never);
    vi.spyOn(api, 'createSetupCode').mockResolvedValue({
      code: CODE,
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    vi.stubGlobal('location', { ...window.location, assign, origin: 'https://app.test' });
    vi.stubGlobal('ClipboardItem', undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: write },
      configurable: true,
    });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    assign.mockReset();
    write.mockClear();
  });

  it('picks Antigravity first, and its button copies the prompt with a new code', async () => {
    openSetupTab();
    expect(screen.getByRole('radio', { name: /Antigravity/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    const button = await screen.findByRole('button', { name: /Copy setup prompt/ });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(write).toHaveBeenCalledWith(codeSetupPrompt(SERVER, CODE)));
    expect(api.createSetupCode).toHaveBeenCalledWith({ name: 'Antigravity' });
    expect(await screen.findByText(CODE)).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent(/Works once · (10:00|9:5\d) left/);
    expect(assign).not.toHaveBeenCalled();
  });

  it('opens Codex with the prompt in the link, and keeps the link to open it again', async () => {
    openSetupTab();
    fireEvent.click(screen.getByRole('radio', { name: /Codex/ }));
    const button = await screen.findByRole('button', { name: /Open in Codex/ });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    const link = `codex://new?prompt=${encodeURIComponent(codeSetupPrompt(SERVER, CODE))}`;
    await waitFor(() => expect(assign).toHaveBeenCalledWith(link));
    expect(await screen.findByRole('link', { name: /Open in Codex/ })).toHaveAttribute(
      'href',
      link,
    );
    expect(screen.getByRole('button', { name: 'Copy prompt instead' })).toBeInTheDocument();
  });

  it('says Claude Code opens in a terminal', () => {
    openSetupTab();
    fireEvent.click(screen.getByRole('radio', { name: /Claude Code/ }));
    expect(screen.getByText(/Opens Claude Code in a terminal/)).toBeInTheDocument();
  });

  it('makes a new code only when asked', async () => {
    openSetupTab();
    const button = await screen.findByRole('button', { name: /Copy setup prompt/ });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await screen.findByText(CODE);
    fireEvent.click(screen.getByRole('button', { name: /Copy setup prompt/ }));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    expect(api.createSetupCode).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'New code' }));
    await waitFor(() => expect(api.createSetupCode).toHaveBeenCalledTimes(2));
  });

  it('keeps the token form for setting it up by hand', () => {
    openSetupTab();
    fireEvent.click(screen.getByRole('button', { name: /Set it up by hand instead/ }));
    expect(screen.getByRole('form', { name: 'Create a setup prompt' })).toBeInTheDocument();
  });
});