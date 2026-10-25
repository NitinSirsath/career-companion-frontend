import { isApiError } from '../api/client';
import { AIAccessUnavailableDetailsSchema } from '../contracts/ai';

/** Why the AI could not write a draft, in one line, and where to fix it when the user can. */
export interface DraftProblem {
  text: string;
  /** "Fix it on AI providers" or "Choose how mails are read". */
  link: string | null;
}

const BUSY =
  'The AI is busy, so it could not write a reply. Try again in a few minutes, or write it yourself.';

/** The one line the reply box shows when "Write with AI" did not work (owner, 24 Oct 2026). */
export function draftProblem(error: unknown): DraftProblem {
  if (!isApiError(error))
    return { text: 'Could not write a draft. Write your reply yourself.', link: null };
  if (error.code !== 'AI_ACCESS_UNAVAILABLE') return { text: error.message, link: null };
  const details = AIAccessUnavailableDetailsSchema.safeParse(error.details);
  const reason = details.success ? details.data.reason : null;
  if (reason === 'SAFETY_LIMIT')
    return {
      text: "You've used today's AI calls. AI can write replies again tomorrow. You can still write it yourself.",
      link: null,
    };
  if (reason === 'NOT_SET_UP')
    return {
      text: 'AI is not set up, so it cannot write replies.',
      link: 'Choose how mails are read',
    };
  if (details.success && details.data.state === 'NEEDS_ATTENTION')
    return {
      text: 'Your AI setup has a problem, so it could not write a reply.',
      link: 'Fix it on AI providers',
    };
  return { text: BUSY, link: null };
}
