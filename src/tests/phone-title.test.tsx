// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PhoneTitle } from '../components/phone/PhoneTitle';

afterEach(cleanup);

describe('phone title sizes', () => {
  it('keeps a setup page heading for screen readers only, marked for the top bar', () => {
    render(<PhoneTitle size="bar">Gmail sync</PhoneTitle>);
    const heading = screen.getByRole('heading', { level: 1, name: 'Gmail sync' });
    expect(heading).toHaveClass('sr-only');
    expect(heading).toHaveAttribute('data-bar-title');
    expect(heading).not.toHaveAttribute('data-big-title');
  });

  it('shows a detail page heading as a big title that scrolls away', () => {
    render(<PhoneTitle size="detail">Brightwave</PhoneTitle>);
    const heading = screen.getByRole('heading', { level: 1, name: 'Brightwave' });
    expect(heading).not.toHaveClass('sr-only');
    expect(heading).toHaveAttribute('data-big-title');
  });
});
