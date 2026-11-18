// @vitest-environment jsdom
/**
 * "Install NorthList" (owner, 18 Nov 2026, approved mock `INSTALL-PROMPT-mock/`): the browser's
 * install offer, the iPhone steps, the 20-second wait, Not now for 30 days, and "Install app".
 */
import '@testing-library/jest-dom/vitest';
import { act } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InstallCard } from '../components/InstallCard';
import {
  cardAllowed,
  hideForNow,
  installKind,
  INSTALL_CARD_DELAY_MS,
  openInstall,
  resetInstallForTests,
  startInstallWatch,
} from '../lib/install';

const DAY_MS = 86_400_000;
const CHROME_UA = navigator.userAgent;
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

let choice: 'accepted' | 'dismissed';
const prompt = vi.fn(async () => undefined);

/** The browser offers to install, as Chrome does once the app is installable. */
function offerInstall() {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: choice }) });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

function setAgent(agent: string) {
  Object.defineProperty(navigator, 'userAgent', { value: agent, configurable: true });
}

function setStandalone(on: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: on && query === '(display-mode: standalone)',
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
}

beforeAll(() => {
  startInstallWatch();
});
beforeEach(() => {
  localStorage.clear();
  resetInstallForTests();
  setAgent(CHROME_UA);
  setStandalone(false);
  choice = 'accepted';
  prompt.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('what this browser can do', () => {
  it('nothing without an install offer, and the install box once the browser offers one', () => {
    expect(installKind()).toBeNull();
    const event = offerInstall();
    expect(event.defaultPrevented).toBe(true);
    expect(installKind()).toBe('prompt');
  });

  it('the Share steps on an iPhone, and nothing inside the installed app', () => {
    setAgent(IPHONE_UA);
    expect(installKind()).toBe('ios');
    setStandalone(true);
    expect(installKind()).toBeNull();
  });

  it('nothing once installed from here', () => {
    offerInstall();
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(installKind()).toBeNull();
    setAgent(IPHONE_UA);
    expect(installKind()).toBeNull();
  });
});

describe('Not now', () => {
  it('hides the card for 30 days', () => {
    const now = Date.UTC(2026, 10, 18);
    expect(cardAllowed(now)).toBe(true);
    hideForNow(now);
    expect(cardAllowed(now + 29 * DAY_MS)).toBe(false);
    expect(cardAllowed(now + 30 * DAY_MS)).toBe(true);
  });
});

describe('the card', () => {
  it('shows after 20 seconds, and Install opens the browser box', async () => {
    vi.useFakeTimers();
    offerInstall();
    render(<InstallCard />);
    expect(screen.queryByRole('complementary', { name: 'Install NorthList' })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(INSTALL_CARD_DELAY_MS);
    });
    const card = screen.getByRole('complementary', { name: 'Install NorthList' });
    expect(card).toHaveTextContent('Open it from your dock or home screen, in its own window.');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    });
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(installKind()).toBeNull();
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('Not now hides it, and a closed install box counts as Not now', async () => {
    vi.useFakeTimers();
    offerInstall();
    render(<InstallCard phone />);
    act(() => {
      vi.advanceTimersByTime(INSTALL_CARD_DELAY_MS);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(cardAllowed()).toBe(false);
  });

  it('shows the iPhone steps with Got it, and "Install app" opens it at once, also after Not now', () => {
    setAgent(IPHONE_UA);
    hideForNow();
    render(<InstallCard phone />);
    expect(screen.queryByRole('complementary')).toBeNull();
    act(() => openInstall());
    const card = screen.getByRole('complementary', { name: 'Install NorthList' });
    expect(card).toHaveTextContent('Add NorthList to your Home Screen');
    // The Share icon sits between "Share" and the comma.
    expect(card).toHaveTextContent(/Tap Share ?, then Add to Home Screen\./);
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('"Install app" opens the install box at once where there is one', async () => {
    choice = 'dismissed';
    offerInstall();
    await act(async () => openInstall());
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(cardAllowed()).toBe(false);
  });
});
