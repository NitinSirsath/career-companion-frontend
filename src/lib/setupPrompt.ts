/** Where people get NorthList Apply, the user's own job automation. */
export const NORTHLIST_APPLY_URL = 'https://github.com/NitinSirsath/northlist-apply';

/**
 * The prompt the user pastes into their AI app to connect NorthList Apply (owner, 3 Nov 2026). It
 * carries the server address and a new token, and points the automation at its own connect steps
 * (`instructions/northlist_connect.md` in NorthList Apply), which add NorthList to that app's MCP
 * settings. Built in the browser from the create response; never stored.
 */
export function setupPrompt(serverAddress: string, token: string): string {
  return [
    'Connect this NorthList Apply folder to my NorthList account.',
    '',
    `NorthList server: ${serverAddress}`,
    `Token: ${token}`,
    '',
    "Follow instructions/northlist_connect.md in this folder. Keep the token only in this app's own MCP settings, never in a file in this folder. If that file is missing, tell me to download NorthList Apply again.",
  ].join('\n');
}
