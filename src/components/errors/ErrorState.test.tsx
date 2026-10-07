// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('shows error details in development', () => {
    vi.stubEnv('DEV', true);
    const error = new Error('secret failure');

    render(
      <ErrorState
        title="Something went wrong"
        message="Please try again."
        error={error}
      />,
    );

    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('secret failure')).toBeInTheDocument();
    expect(screen.getByText(/Error: secret failure/)).toBeInTheDocument();
  });

  it('hides error details in production', () => {
    vi.stubEnv('DEV', false);
    const error = new Error('secret failure');
    error.stack = 'Error: secret failure\n    at secret-source.ts:1:1';

    render(
      <ErrorState
        title="Something went wrong"
        message="Please try again."
        error={error}
      />,
    );

    expect(screen.queryByText('Details')).not.toBeInTheDocument();
    expect(screen.queryByText('secret failure')).not.toBeInTheDocument();
    expect(screen.queryByText(/secret-source\.ts/)).not.toBeInTheDocument();
  });
});
