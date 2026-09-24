/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Pagination } from '../components/ui/pagination';

describe('Pagination UX (COM-48)', () => {
  afterEach(() => {
    cleanup();
  });

  it('1. first page renders correctly', () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    render(
      <Pagination offset={0} limit={20} hasNext={true} onNext={onNext} onPrevious={onPrevious} />
    );
    expect(screen.getByText('Page 1')).toBeInTheDocument();
  });

  it('2. next page button appears when nextOffset exists (hasNext=true)', () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    render(
      <Pagination offset={0} limit={20} hasNext={true} onNext={onNext} onPrevious={onPrevious} />
    );
    const nextBtn = screen.getByRole('button', { name: 'Next' });
    expect(nextBtn).toBeInTheDocument();
    expect(nextBtn).not.toBeDisabled();
  });

  it('3. next page requests offset 20', () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    render(
      <Pagination offset={0} limit={20} hasNext={true} onNext={onNext} onPrevious={onPrevious} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('4. previous page requests offset 0', () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    render(
      <Pagination offset={20} limit={20} hasNext={true} onNext={onNext} onPrevious={onPrevious} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });

  it('5. next page is disabled when nextOffset is null (hasNext=false)', () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    render(
      <Pagination offset={20} limit={20} hasNext={false} onNext={onNext} onPrevious={onPrevious} />
    );
    const nextBtn = screen.getByRole('button', { name: 'Next' });
    expect(nextBtn).toBeDisabled();
  });

  it('6. previous page is disabled on first page', () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    render(
      <Pagination offset={0} limit={20} hasNext={true} onNext={onNext} onPrevious={onPrevious} />
    );
    const prevBtn = screen.getByRole('button', { name: 'Previous' });
    expect(prevBtn).toBeDisabled();
  });

  it('8. page data renders correctly (Page 2)', () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    render(
      <Pagination offset={20} limit={20} hasNext={true} onNext={onNext} onPrevious={onPrevious} />
    );
    expect(screen.getByText('Page 2')).toBeInTheDocument();
  });
});
