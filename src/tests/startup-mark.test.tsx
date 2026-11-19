// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { Logo } from '../components/layout/Logo';
import { StartupScreen } from '../components/startup/StartupScreen';
import { STARTUP_LEAVE_MS } from '../lib/startup';
import { THEME_STORAGE_KEY, WINDOW_BAR_COLOR } from '../lib/theme';

const indexHtml = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');

/** The page as `index.html` draws it, before the app's code runs. */
function openPage() {
  document.body.innerHTML = new DOMParser().parseFromString(indexHtml, 'text/html').body.innerHTML;
  return document.getElementById('startup')!;
}

describe('the start-up mark in index.html', () => {
  it('is the large logo mark, in parts', () => {
    const mark = openPage();
    const { container } = render(<Logo size={56} />);
    const logo = container.querySelector('path')!.getAttribute('d');
    const parts = [...mark.querySelectorAll('path')].map((path) => path.getAttribute('d'));
    expect(parts).toHaveLength(4);
    expect(parts.join('')).toBe(logo);
    expect(mark).toHaveAttribute('aria-hidden', 'true');
  });

  it('reads the saved theme with the app’s key and bar colour, so dark mode never starts white', () => {
    expect(indexHtml).toContain(`localStorage.getItem('${THEME_STORAGE_KEY}')`);
    expect(indexHtml).toContain(`content = '${WINDOW_BAR_COLOR.dark}'`);
  });

  it('fades out in the time the app waits for', () => {
    expect(indexHtml).toContain(`startup-leave ${STARTUP_LEAVE_MS}ms`);
  });
});

describe('the start-up screen and the mark', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('keeps the mark moving while it checks, and makes it still when nothing loads', () => {
    const mark = openPage();
    const { rerender } = render(
      <StartupScreen stage="checking" waitedMs={0} onRetry={() => undefined} />,
    );
    expect(mark).not.toHaveAttribute('data-still');
    rerender(<StartupScreen stage="cannot-reach" waitedMs={120_000} onRetry={() => undefined} />);
    expect(mark).toHaveAttribute('data-still');
    rerender(<StartupScreen stage="waking" waitedMs={5_000} onRetry={() => undefined} />);
    expect(mark).not.toHaveAttribute('data-still');
  });

  it('lets the mark fade away when the app opens, then removes it', () => {
    const mark = openPage();
    const { unmount } = render(
      <StartupScreen stage="checking" waitedMs={0} onRetry={() => undefined} />,
    );
    unmount();
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(mark).toHaveClass('startup-leave');
    expect(document.getElementById('startup')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(STARTUP_LEAVE_MS);
    });
    expect(document.getElementById('startup')).not.toBeInTheDocument();
  });

  it('keeps the mark when React’s dev mode mounts the screen twice', () => {
    const mark = openPage();
    render(
      <StrictMode>
        <StartupScreen stage="checking" waitedMs={0} onRetry={() => undefined} />
      </StrictMode>,
    );
    act(() => {
      vi.advanceTimersByTime(STARTUP_LEAVE_MS * 2);
    });
    expect(mark).toBeInTheDocument();
    expect(mark).not.toHaveClass('startup-leave');
  });
});
