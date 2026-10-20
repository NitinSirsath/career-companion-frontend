/**
 * Words for the Gmail connection card. `sandbox`: the mail sandbox stands in for Gmail (dev mode,
 * or a test account).
 */
export function gmailConnectionCopy(sandbox: boolean, status: string | null | undefined) {
  if (sandbox)
    return {
      connect: 'Connect sandbox mailbox',
      notConnected:
        'Not connected. Here your Gmail account is the mail sandbox: no Google account is used.',
      connectedNote: 'Sandbox mailbox.',
    };
  const revoked = status === 'REVOKED';
  return {
    connect: revoked ? 'Reconnect Gmail' : 'Connect Gmail',
    notConnected: revoked ? 'Gmail access was revoked. Please reconnect.' : 'Gmail not connected',
    connectedNote: null,
  };
}
