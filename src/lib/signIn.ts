import { z } from 'zod';
import { isApiError } from '../api/client';
import { PASSWORD_MIN_LENGTH, SetPasswordRequestSchema } from '../contracts/auth';

/** Server answers that are already written for the user to read. */
const SAY_AS_IS = ['INVALID_CREDENTIALS', 'TOO_MANY_ATTEMPTS', 'WRONG_PASSWORD', 'EMAIL_TAKEN'];

/** What to tell the user when signing in, creating a user or saving a password did not work. */
export function signInProblem(error: unknown): string {
  if (!isApiError(error)) return 'Something went wrong. Try again.';
  if (error.code && SAY_AS_IS.includes(error.code)) return error.message;
  if (error.code === 'VALIDATION_ERROR') return 'Check what you entered and try again.';
  if (error.kind === 'network' || error.kind === 'timeout') return error.message;
  return 'Something went wrong. Try again.';
}

/** The message for the `error` the backend adds to the login address after Google sign-in. */
export function googleSignInProblem(code: string): string {
  if (code === 'denied') return 'You denied the sign-in request. Please try again.';
  if (code === 'csrf') return 'Your session expired or was invalid. Please try signing in again.';
  if (code === 'expired') return 'Your session has expired. Please sign in again.';
  return 'An unexpected authentication error occurred. Please try again.';
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
