// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppErrorBoundary } from './AppErrorBoundary';

function ThrowingComponent(): never {
  throw new Error('boundary failure');
}

describe('AppErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders recovery UI instead of a blank screen', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <ThrowingComponent />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'Career Companion needs to restart' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('can retry by resetting the boundary state', () => {
    let shouldThrow = true;

    function ConditionalComponent() {
      if (shouldThrow) {
        throw new Error('temporary failure');
      }

      return <div>Recovered outside router</div>;
    }

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <AppErrorBoundary>
        <ConditionalComponent />
      </AppErrorBoundary>,
    );

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByText('Recovered outside router')).toBeInTheDocument();
  });
});
