// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../components/ThemeProvider';
import { THEME_CHOICES } from '../lib/theme';

const KEY = 'career-companion-theme';

describe('flat themes', () => {
  afterEach(() => {
    cleanup();
    localStorage.removeItem(KEY);
    document.documentElement.className = '';
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove());
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

  it('colours the installed window bar like the page, and follows a theme change', () => {
    document.head.insertAdjacentHTML('beforeend', '<meta name="theme-color" content="#ffffff">');
    localStorage.setItem(KEY, 'dark');
    function LightButton() {
      const { setTheme } = useTheme();
      return <button onClick={() => setTheme('light')}>Light</button>;
    }
    render(
      <ThemeProvider storageKey={KEY}>
        <LightButton />
      </ThemeProvider>,
    );
    const bars = document.head.querySelectorAll('meta[name="theme-color"]');
    expect(bars).toHaveLength(1);
    expect(bars[0]).toHaveAttribute('content', '#0d0d0d');

    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(bars[0]).toHaveAttribute('content', '#ffffff');
  });

  it('adds the window bar colour when the page has none', () => {
    localStorage.setItem(KEY, 'light');
    render(
      <ThemeProvider storageKey={KEY}>
        <p>Page</p>
      </ThemeProvider>,
    );
    expect(document.head.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      '#ffffff',
    );
  });
});
