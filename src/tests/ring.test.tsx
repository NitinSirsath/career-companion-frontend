// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Ring, StatusBadge } from '../components/ui/ring';

afterEach(cleanup);

describe('status ring', () => {
  it('fills a quarter, half and three quarters for recruiter, assessment and interview', () => {
    const { container } = render(
      <>
        <Ring kind="recruiter" />
        <Ring kind="assessment" />
        <Ring kind="interview" />
      </>,
    );
    const slices = [...container.querySelectorAll('svg')].map(
      (svg) => svg.querySelector('path')?.getAttribute('d') ?? '',
    );
    // The slice ends at 3 o'clock, 6 o'clock and 9 o'clock.
    expect(slices[0]).toMatch(/A4 4 0 0 1 12\.000 8\.000Z$/);
    expect(slices[1]).toMatch(/A4 4 0 0 1 8\.000 12\.000Z$/);
    expect(slices[2]).toMatch(/A4 4 0 1 1 4\.000 8\.000Z$/);
  });

  it('is an empty ring for Applied, a check for Offer and a × once closed', () => {
    const { container } = render(
      <>
        <Ring kind="applied" />
        <Ring kind="offer" />
        <Ring kind="closed" />
      </>,
    );
    const [applied, offer, closed] = container.querySelectorAll('svg');
    expect(applied.querySelector('path')).toBeNull();
    expect(offer.querySelector('circle')).toHaveAttribute('fill', 'currentColor');
    expect(closed.querySelector('path')?.getAttribute('d')).toContain('M5.8 5.8');
  });

  it('is hidden from screen readers unless it stands alone with a label', () => {
    render(<Ring kind="interview" label="Interview" />);
    expect(screen.getByRole('img', { name: 'Interview' })).toBeInTheDocument();
  });

  it('shows a status as ring and words, and an unknown status as "Status unknown"', () => {
    const { container } = render(
      <>
        <StatusBadge status="REJECTED" />
        <StatusBadge status={null} />
      </>,
    );
    expect(container).toHaveTextContent('RejectedStatus unknown');
    expect(container.querySelector('[data-ring="closed"]')).toBeInTheDocument();
  });
});
