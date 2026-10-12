/** Words for the Gmail connection card. In dev mode the mail sandbox stands in for Gmail. */
export function gmailConnectionCopy(devMode: boolean, status: string | null | undefined) {
  if (devMode)
    return {
      connect: 'Connect sandbox mailbox',
      notConnected:
        'Not connected. In dev mode your Gmail account is the mail sandbox: no Google account is used.',
      connectedNote: 'Sandbox mailbox.',
    };
  const revoked = status === 'REVOKED';
  return {
    connect: revoked ? 'Reconnect Gmail' : 'Connect Gmail',
    notConnected: revoked ? 'Gmail access was revoked. Please reconnect.' : 'Gmail not connected',
    connectedNote: null,
  };
}
