import { CONTACT_EMAIL } from '../../lib/productPage';
import {
  BETA_FULL,
  BETA_FULL_TEXT,
  BETA_FULL_TITLE,
  googleSignInProblem,
  googleSignInUrl,
} from '../../lib/signIn';
import { cn } from '../../lib/utils';
import { InlineNotification } from '../ui/notification';

/** Google's own "G" in its four colours, as Google's sign-in button rules ask. */
function GoogleG({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={cn('shrink-0', className)}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/** The Google button's look: laptops and tablets, and the bigger, round phone button. */
const LOOKS = {
  wide: {
    button: 'h-11 rounded-lg text-[15px] font-medium',
    icon: 'size-[18px]',
    hint: 'text-xs',
    words: 'New here? Continuing with Google creates your account.',
  },
  // Phones (owner, 15 Nov 2026, approved mock `SIGNIN-PHONE-mock/`): a shorter hint under the button.
  phone: {
    button: 'h-[52px] rounded-full text-[17px] font-semibold',
    icon: 'size-5',
    hint: 'text-[13px] leading-[18px]',
    words: 'New here? This creates your account.',
  },
} as const;

/**
 * Google first (owner, 3 Nov 2026): only Google creates accounts, so it is the main way in, in
 * Google's own dark button.
 */
export function GoogleSignIn({ next, phone = false }: { next: string | null; phone?: boolean }) {
  const look = LOOKS[phone ? 'phone' : 'wide'];
  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => {
          window.location.href = googleSignInUrl(next);
        }}
        className={cn(
          'flex w-full cursor-pointer items-center justify-center gap-2.5 border border-[#131314] bg-[#131314] text-[#f2f2f2] shadow-[0_1px_2px_rgb(0_0_0/0.08)] transition-colors duration-70 ease-standard hover:bg-[#2b2b2e]',
          look.button,
        )}
      >
        <GoogleG className={look.icon} />
        Continue with Google
      </button>
      <p className={cn('text-center text-text-tertiary', look.hint)}>{look.words}</p>
    </div>
  );
}

/**
 * Why the last Google sign-in did not work. A full beta is not the user's mistake: a warning
 * with the address to ask for a place, instead of an error.
 */
export function GoogleSignInProblem({ error }: { error: string }) {
  if (error !== BETA_FULL)
    return <InlineNotification kind="error">{googleSignInProblem(error)}</InlineNotification>;
  return (
    <InlineNotification kind="warning" title={BETA_FULL_TITLE}>
      {BETA_FULL_TEXT}{' '}
      <a href={`mailto:${CONTACT_EMAIL}`} className="text-link underline hover:text-link-hover">
        {CONTACT_EMAIL}
      </a>
      .
    </InlineNotification>
  );
}
