// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ThemeProvider } from '../components/ThemeProvider';
import { THEME_CHOICES } from '../lib/theme';

const KEY = 'career-companion-theme';

describe('flat themes', () => {
  afterEach(() => {
    cleanup();
    localStorage.removeItem(KEY);
    document.documentElement.className = '';
  });

  it('offers System, Light and Dark only', () => {
    expect(THEME_CHOICES.map((choice) => choice.label)).toEqual(['System', 'Light', 'Dark']);
  });

  it('opens a saved White as System, which shows Light on a light computer', () => {
    localStorage.setItem(KEY, 'white');
    render(
      <ThemeProvider storageKey={KEY}>
        <p>Page</p>
      </ThemeProvider>,
    );
    expect(document.documentElement).toHaveClass('theme-light');
    expect(document.documentElement).not.toHaveClass('theme-white');
  });

  it('keeps a saved Dark', () => {
    localStorage.setItem(KEY, 'dark');
    render(
      <ThemeProvider storageKey={KEY}>
        <p>Page</p>
      </ThemeProvider>,
    );
    expect(document.documentElement).toHaveClass('theme-dark', 'dark');
  });
});
