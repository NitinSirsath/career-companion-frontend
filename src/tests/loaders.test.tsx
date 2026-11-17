// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { PhoneRefresh } from '../components/phone/PhoneRefresh';
import { SkeletonList, SkeletonRows } from '../components/ui/skeleton';

const SRC = resolve(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'tests' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** The loader that says `label` to screen readers. */
const loaderFor = (label: string) =>
  screen.getByText(label).closest<HTMLElement>('[role="status"]')!;

afterEach(cleanup);

describe('loaders', () => {
  it('draws every grey loader shape through ui/skeleton.tsx', () => {
    // The `skeleton` class at the start or end of a class string.
    // A page that draws its own grey rows skips the shared side space (owner, 17 Nov 2026).
    const ownLoaders = sourceFiles(SRC)
      .filter((file) => !file.endsWith(join('ui', 'skeleton.tsx')))
      .filter((file) => /["'`]skeleton[\s"'`]|\sskeleton["'`]/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file));
    expect(ownLoaders).toEqual([]);
  });

  it('takes the list side space, and says what is loading', () => {
    render(<SkeletonRows label="Loading job mails" />);
    const rows = loaderFor('Loading job mails');
    expect(rows).toHaveClass('px-[var(--list-inset,0px)]');
    render(<SkeletonList label="Loading history" />);
    expect(loaderFor('Loading history')).toHaveClass('px-[var(--list-inset,0px)]');
  });

  it('lets a padded group set its own side space instead', () => {
    render(<SkeletonList label="Loading applications" className="px-4" />);
    const list = loaderFor('Loading applications');
    expect(list).toHaveClass('px-4');
    expect(list).not.toHaveClass('px-[var(--list-inset,0px)]');
  });
});

describe('the refresh icon over a saved copy', () => {
  /** A page showing `key`'s data, saved `ageMs` ago, while it is fetched again and never answers. */
  function showSaved(ageMs: number) {
    const client = new QueryClient();
    client.setQueryData(['conversations'], { items: [] }, { updatedAt: Date.now() - ageMs });
    function Page() {
      useQuery({ queryKey: ['conversations'], queryFn: () => new Promise(() => {}) });
      return <PhoneRefresh />;
    }
    render(
      <QueryClientProvider client={client}>
        <Page />
      </QueryClientProvider>,
    );
  }

  it('turns while the app checks for new data behind a saved list, as phone mail apps do', async () => {
    showSaved(5 * 60_000);
    const button = await screen.findByRole('button', { name: 'Refreshing…' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('svg')).toHaveClass('animate-spin');
  });

  it('stays still while fresh data is checked again, so a list that polls does not spin', async () => {
    showSaved(5_000);
    const button = await screen.findByRole('button', { name: 'Refresh' });
    expect(button.querySelector('svg')).not.toHaveClass('animate-spin');
  });
});
