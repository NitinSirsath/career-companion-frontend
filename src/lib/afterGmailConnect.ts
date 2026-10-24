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
