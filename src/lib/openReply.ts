/**
 * "Reply" on a phone's application page opens the mail with its reply already open (owner,
 * 12 Nov 2026): the link carries this in the browser's history state, not in the address.
 */
declare module '@tanstack/history' {
  interface HistoryState {
    openReply?: boolean;
  }
}

export const OPEN_REPLY = { openReply: true } as const;
