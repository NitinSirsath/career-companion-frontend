import { FREE_AI_CONSENT } from './freeAI';

const KEY = 'career-companion-gmail-connect';

/**
 * The user leaves for Google to connect Gmail. The page they come back to then knows the
 * connection is new (owner, 24 Oct 2026: a new user goes on to choose how mails are read).
 */
export function markGmailConnectStarted() {
  try {
    sessionStorage.setItem(KEY, 'started');
  } catch {
    // A blocked storage only means the user stays on the Gmail page.
  }
}

/** True once after the user came back from connecting Gmail; the mark is gone after it. */
export function takeGmailConnectStarted(): boolean {
  try {
    const started = sessionStorage.getItem(KEY) === 'started';
    sessionStorage.removeItem(KEY);
    return started;
  } catch {
    return false;
  }
}

/**
 * "Connect Gmail" (owner, 15 Nov 2026). `freeAI`: the button said that NorthList's free AI reads
 * the job mails, so pressing it agrees; the server turns the free AI on, starts the first sync and
 * sends the user back to the Dashboard. Otherwise the user comes back to the Gmail page and, with
 * no AI yet, goes on to choose one.
 */
export function startGmailConnect(freeAI: boolean) {
  if (freeAI) {
    window.location.href = gmailConnectUrl('/dashboard', true);
    return;
  }
  markGmailConnectStarted();
  window.location.href = '/api/gmail/connect';
}

/**
 * Where "Connect Gmail" goes when the user should come back to `returnTo` (the Dashboard, or the
 * first run, owner 22 Nov 2026). `freeAI`: the button said the free AI reads the job mails.
 */
export function gmailConnectUrl(returnTo: string, freeAI: boolean): string {
  const query = new URLSearchParams({ returnTo });
  if (freeAI) query.set('freeAI', FREE_AI_CONSENT);
  return `/api/gmail/connect?${query.toString()}`;
}
