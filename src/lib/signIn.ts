import { z } from 'zod';
import { isApiError } from '../api/client';
import { PASSWORD_MIN_LENGTH, SetPasswordRequestSchema } from '../contracts/auth';
import { CONTACT_EMAIL } from './productPage';

/** Server answers that are already written for the user to read. */
const SAY_AS_IS = [
  'INVALID_CREDENTIALS',
  'TOO_MANY_ATTEMPTS',
  'WRONG_PASSWORD',
  'EMAIL_TAKEN',
  'USE_TEST_LOGIN',
  'NOT_TEST_ACCOUNT',
  'TEST_ACCOUNT',
];

/** What to tell the user when signing in, creating a user or saving a password did not work. */
export function signInProblem(error: unknown): string {
  if (!isApiError(error)) return 'Something went wrong. Try again.';
  if (error.code && SAY_AS_IS.includes(error.code)) return error.message;
  if (error.code === 'VALIDATION_ERROR') return 'Check what you entered and try again.';
  if (error.kind === 'network' || error.kind === 'timeout') return error.message;
  return 'Something went wrong. Try again.';
}

/**
 * Google sign-in refused a new account: the beta has all its places (owner, 31 Oct 2026). The
 * sign-in page shows it as a warning with the contact address, not as an error.
 */
export const BETA_FULL = 'beta_full';
export const BETA_FULL_TITLE = 'The NorthList beta is full.';
export const BETA_FULL_TEXT =
  'The beta is limited to 100 users and every place is taken. To ask for a place, write to';

/** The message for the `error` the backend adds to the login address after Google sign-in. */
export function googleSignInProblem(code: string): string {
  if (code === BETA_FULL) return `${BETA_FULL_TITLE} ${BETA_FULL_TEXT} ${CONTACT_EMAIL}.`;
  if (code === 'denied') return 'You denied the sign-in request. Please try again.';
  if (code === 'csrf') return 'Your session expired or was invalid. Please try signing in again.';
  if (code === 'expired') return 'Your session has expired. Please sign in again.';
  if (code === 'test_account') return 'This is a test account. Sign in on the test sign-in page.';
  return 'An unexpected authentication error occurred. Please try again.';
}

/** Pages for signed-out visitors: the sign-in, and the test account sign-in. */
export const SIGN_IN_PAGES = ['/login', '/test-login'];

/**
 * The product page (owner, 31 Oct 2026): public, so Google's OAuth branding can name it as the
 * home page. Not a sign-in page: a signed-in user there goes on to the app's home page, while a
 * sign-in page sends them to `/`, which would loop.
 */
export const PRODUCT_PAGE = '/';

/** A page a visitor who is not signed in may open. */
export const isPublicPage = (pathname: string) =>
  pathname === PRODUCT_PAGE || SIGN_IN_PAGES.includes(pathname);

/**
 * "Someone has signed in on this browser before": only a yes, kept in this browser. A browser
 * that keeps nothing (private mode, blocked storage) counts as new.
 */
const SIGNED_IN_BEFORE = 'northlist.signedInBefore';

export function wasSignedInBefore(): boolean {
  try {
    return window.localStorage.getItem(SIGNED_IN_BEFORE) === 'yes';
  } catch {
    return false;
  }
}

export function rememberSignedIn() {
  try {
    window.localStorage.setItem(SIGNED_IN_BEFORE, 'yes');
  } catch {
    // Nothing is kept: this browser shows the product page at once next time too.
  }
}

/**
 * The product page shows at once, before the server says who is signed in, only at `/` in a
 * browser where nobody has signed in (owner, 31 Oct 2026). A sleeping server can take a minute to
 * answer, and a new visitor, or Google's reviewer, should not wait for it. Anyone else waits as
 * before, so a signed-in user never sees the product page first.
 */
export const productPageAtOnce = (pathname: string, signedInBefore: boolean) =>
  pathname === PRODUCT_PAGE && !signedInBefore;

/**
 * The page to open after sign-in, from the `next` in the sign-in page's address. Only a path
 * inside the app counts: one leading "/", then printable characters with no backslash, and not
 * a sign-in page itself. Anything else gives null, and the app opens its home page.
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\/(?![/\\])[\x21-\x7e]*$/.test(value)) return null;
  if (value.includes('\\')) return null;
  return SIGN_IN_PAGES.includes(value.split(/[?#]/)[0]) ? null : value;
}

/** After sign-in: a fresh page load of the page asked for, so the app starts with the new session. */
export function openApp(next: string | null) {
  window.location.href = next ?? '/';
}

/** Where Google sign-in starts; the server sends the user back to `next` afterwards. */
export function googleSignInUrl(next: string | null): string {
  return next ? `/api/auth/connect?returnTo=${encodeURIComponent(next)}` : '/api/auth/connect';
}

export const EMAIL_PROBLEM = 'Enter a valid email address.';
export const PASSWORD_PROBLEM = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
export const PASSWORD_MISSING = 'Enter your password.';

/**
 * The "set password" form: the request plus the password typed a second time. A user who
 * already has a password must also give the current one.
 */
export function setPasswordFormSchema(hasPassword: boolean) {
  return SetPasswordRequestSchema.extend({ repeatPassword: z.string() })
    .refine((form) => form.newPassword === form.repeatPassword, {
      path: ['repeatPassword'],
      message: 'The two passwords are not the same.',
    })
    .refine((form) => !hasPassword || !!form.currentPassword, {
      path: ['currentPassword'],
      message: 'Enter your current password.',
    });
}
export type SetPasswordForm = z.infer<ReturnType<typeof setPasswordFormSchema>>;
