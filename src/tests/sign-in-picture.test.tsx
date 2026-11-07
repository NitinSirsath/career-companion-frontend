// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { PasswordSignInForm } from '../components/auth/PasswordSignInForm';
import { SignInLayout } from '../components/auth/SignInLayout';
import { NEW_MAILS, PICTURE_STEP_WAITS_MS, pictureAt } from '../lib/signInPicture';

function withQuery(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

/** The "… mails need you" lines: one in the laptop panel, one in the phone band. */
const needYouLines = () =>
  screen.getAllByText(
    (_, el) => el?.tagName === 'P' && /mails need you/.test(el.textContent ?? ''),
  );

let reduceMotion = false;
beforeEach(() => {
  reduceMotion = false;
  vi.useFakeTimers();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ mode: 'prod' }))),
  );
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduceMotion, media: query }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the sign-in picture (owner, 7 Nov 2026)', () => {
  it('starts with five mails, then two come in and are read, newest first', () => {
    expect(pictureAt(0)).toMatchObject({ needYou: 4, jobMails: 5 });
    expect(pictureAt(0).rows.every((row) => !row.arrived)).toBe(true);

    const first = pictureAt(1);
    expect(first.rows[0]).toMatchObject({ mail: NEW_MAILS[0], reading: true, arrived: true });
    expect(first).toMatchObject({ needYou: 4, jobMails: 6 });

    expect(pictureAt(2)).toMatchObject({ needYou: 5, jobMails: 6 });
    expect(pictureAt(2).rows[0].reading).toBe(false);

    const second = pictureAt(3);
    expect(second.rows.map((row) => row.mail.sender).slice(0, 2)).toEqual([
      'Cedar Talent',
      'Priya Nair',
    ]);
    expect(second.rows[0].reading).toBe(true);

    // The second mail is a rejection: nothing more needs the user.
    const last = pictureAt(4);
    expect(last).toMatchObject({ needYou: 5, jobMails: 7 });
    expect(last.rows.some((row) => row.reading)).toBe(false);
  });

  it('shows the AI reading the new mail, then its step and the new count, then stops', () => {
    withQuery(
      <SignInLayout>
        <p>Form</p>
      </SignInLayout>,
    );
    expect(needYouLines()[0]).toHaveTextContent('4 mails need you');
    expect(screen.queryByText('Reading the mail')).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(PICTURE_STEP_WAITS_MS[0]));
    expect(screen.getAllByText('Reading the mail')).toHaveLength(2);
    expect(needYouLines()[0]).toHaveTextContent('4 mails need you');

    act(() => vi.advanceTimersByTime(PICTURE_STEP_WAITS_MS[1]));
    expect(screen.queryByText('Reading the mail')).not.toBeInTheDocument();
    expect(screen.getAllByText('Pick a time for the first interview')).toHaveLength(2);
    for (const line of needYouLines()) expect(line).toHaveTextContent('5 mails need you');

    // Each step starts its own wait once the one before has shown.
    for (const wait of PICTURE_STEP_WAITS_MS.slice(2)) act(() => vi.advanceTimersByTime(wait));
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getAllByText('Update on your UI Engineer application')).toHaveLength(2);
    expect(screen.queryByText('Reading the mail')).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stays still when the computer asks for less motion', () => {
    reduceMotion = true;
    withQuery(
      <SignInLayout>
        <p>Form</p>
      </SignInLayout>,
    );
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.queryByText('Reading the mail')).not.toBeInTheDocument();
    expect(screen.queryByText(NEW_MAILS[0].subject)).not.toBeInTheDocument();
    expect(needYouLines()[0]).toHaveTextContent('4 mails need you');
  });

  it('puts the headline and a small picture above the form on phones and tablets', () => {
    withQuery(
      <SignInLayout>
        <p>Form</p>
      </SignInLayout>,
    );
    const headlines = screen.getAllByText('Your job search, sorted from your Gmail.');
    expect(headlines).toHaveLength(2);
    const band = headlines[0].parentElement;
    expect(band).toHaveClass('lg:hidden');
    expect(band).toHaveAttribute('aria-hidden', 'true');
    // The band comes before the form, and the footer right after it.
    expect(band?.compareDocumentPosition(screen.getByText('Form'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByRole('main')).not.toHaveClass('flex-1');
  });
});

describe('the Sign in button', () => {
  it('is the filled blue button, also when Google is offered', () => {
    withQuery(<PasswordSignInForm onSignedIn={() => undefined} withGoogle />);
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveClass('bg-action-primary');
    expect(screen.getByRole('button', { name: 'Forgot password?' })).toBeInTheDocument();
  });
});
