// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { DevErrorTrigger } from './DevErrorTrigger';

describe('DevErrorTrigger', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    window.history.replaceState({}, '', '/');
  });

  it('throws only for ?__throw=render when DEV is true', () => {
    vi.stubEnv('DEV', true);
    window.history.replaceState({}, '', '/?__throw=render');

    expect(() => render(<DevErrorTrigger />)).toThrow('Development render error trigger');
  });

  it('never throws when DEV is false', () => {
    vi.stubEnv('DEV', false);
    window.history.replaceState({}, '', '/?__throw=render');

    expect(() => render(<DevErrorTrigger />)).not.toThrow();
  });
});
