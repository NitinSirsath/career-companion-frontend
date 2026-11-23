/** Where people get NorthList Apply, the user's own job automation. */
export const NORTHLIST_APPLY_URL = 'https://github.com/NitinSirsath/northlist-apply';
/** The whole folder as one download, from its default branch. */
export const NORTHLIST_APPLY_ZIP_URL = `${NORTHLIST_APPLY_URL}/archive/refs/heads/master.zip`;
export const NORTHLIST_APPLY_CLONE = `git clone ${NORTHLIST_APPLY_URL}.git`;

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
  ].join('\\n');
}

type AIApp = 'antigravity' | 'codex' | 'claude-code';

/**
 * The one-click setup prompt (owner, 23 Nov 2026): a setup code that works once, for 10 minutes,
 * instead of a token, so the prompt can travel in an "Open in …" link. The AI app finds or
 * downloads NorthList Apply, then swaps the code for a token by its connect steps.
 */
export function codeSetupPrompt(serverAddress: string, code: string): string {
  return [
    'Connect NorthList Apply to my NorthList account.',
    `NorthList server: ${serverAddress}`,
    `Setup code: ${code} (works once, for 10 minutes)`,
    '',
    '1. Find my NorthList Apply folder: this chat\\'s folder if it has AGENTS.md and instructions/northlist_connect.md, else "Documents/NorthList Apply" in my home folder. Look nowhere else.',
    `2. If there is none, ask me: "I can't find NorthList Apply. Reply with its folder, or reply download and I'll put it in Documents/NorthList Apply." To download: get ${NORTHLIST_APPLY_ZIP_URL}, unzip it, and put the files of its northlist-apply-master folder into "Documents/NorthList Apply".`,
    '3. Then read instructions/northlist_connect.md in that folder and follow it.',
  ].join('\\n');
}

/**
 * The link that opens the AI app with the prompt typed in, or null when the app has none
 * (Antigravity: the prompt is copied). Claude Code's link opens it in a terminal.
 */
export function openAppLink(app: AIApp, prompt: string) {
  const text = encodeURIComponent(prompt);
  if (app === 'codex') return `codex://new?prompt=${text}`;
  if (app === 'claude-code') return `claude-cli://open?q=${text}`;
  return null;
}

/** What the user does in the AI app after the button. */
export function inAppText(key: AIApp, name: string) {
  if (key === 'antigravity')
    return 'Open a new chat in Antigravity, paste the prompt and send it. It finds or downloads NorthList Apply, connects it, and asks you to allow the change. Then refresh its MCP servers and type start.';
  return `${name} opens with the prompt typed in: press Enter. It finds or downloads NorthList Apply, connects it, and asks you to allow the change. Then open a new chat and type start.`;
}

/** The button's own line: what it does for this app. */
export function buttonNote(key: AIApp) {
  if (key === 'claude-code')
    return 'Opens Claude Code in a terminal. Works once you have used Claude Code in a terminal; otherwise copy the prompt instead.';
  if (key === 'codex') return 'Opens a new Codex chat with the prompt typed in.';
  return 'Antigravity has no open link, so you paste the prompt there.';
}
