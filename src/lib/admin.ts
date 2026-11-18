import { differenceInCalendarDays, format, isToday, isYesterday } from 'date-fns';
import type {
  AdminAccount,
  AdminFreeAIMoney,
  AdminKeyProblem,
  AdminOverview,
} from '../contracts/admin';
import { modelName, providerName } from './aiLabels';

// The Admin page's words and numbers (owner, 18 Nov 2026, approved mock `ADMIN-PANEL-mock/`).

const FREE_AI = 'career-companion';
/** Under this share of the key's limit the money line turns yellow and shows under Needs a look. */
export const MONEY_LOW_SHARE = 0.2;
export const ACCOUNTS_PER_PAGE = 25;

export const count = (n: number) => n.toLocaleString('en-US');
export const usd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "Today, 4:12 PM", "Yesterday", or "Nov 13". */
export function whenLabel(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return `Today, ${format(date, 'h:mm a')}`;
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d');
}

export const dayLabel = (iso: string) => format(new Date(iso), 'MMM d');

export interface AccountCounts {
  /** Real accounts: the ones the beta limit counts (test accounts left out). */
  real: number;
  test: number;
  gmailConnected: number;
  newThisWeek: number;
  newToday: number;
}

export function accountCounts(accounts: readonly AdminAccount[], now = new Date()): AccountCounts {
  const real = accounts.filter((account) => !account.testAccount);
  const age = (account: AdminAccount) => differenceInCalendarDays(now, new Date(account.createdAt));
  return {
    real: real.length,
    test: accounts.length - real.length,
    gmailConnected: real.filter(
      (account) =>
        account.gmail.state !== 'NOT_CONNECTED' && account.gmail.state !== 'ACCESS_REMOVED',
    ).length,
    newThisWeek: real.filter((account) => age(account) < 7).length,
    newToday: real.filter((account) => age(account) === 0).length,
  };
}

export const KEY_PROBLEM: Record<AdminKeyProblem, string> = {
  KEY_REJECTED: 'Key rejected',
  ACCOUNT_OR_BILLING: 'Billing problem',
  MODEL_UNAVAILABLE: 'Model gone',
  KEY_UNREADABLE: 'Key unreadable',
};

const PAUSE_REASON: Record<AdminOverview['freeAIPauses'][number]['reason'], string> = {
  RATE_LIMITED: 'OpenRouter limited the key',
  PROVIDER_BUSY: 'OpenRouter was busy',
  PROVIDER_UNAVAILABLE: 'OpenRouter was not available',
  KEY_REJECTED: 'OpenRouter refused the key',
  ACCOUNT_OR_BILLING: 'The OpenRouter credit ran out',
  MODEL_UNAVAILABLE: 'The model is not available',
  KEY_UNREADABLE: 'The key could not be read',
};

/** "Free AI" or the provider's name; null when AI is not set up. */
export function aiLabel(account: AdminAccount): string | null {
  if (account.ai.provider === null) return null;
  return account.ai.provider === FREE_AI ? 'Free AI' : providerName(account.ai.provider);
}

/** True when the free AI money is under a fifth of the key's limit. */
export function moneyLow(money: AdminFreeAIMoney | undefined): boolean {
  if (money?.state !== 'OK' || money.limitUsd === null || money.leftUsd === null) return false;
  return money.limitUsd > 0 && money.leftUsd < money.limitUsd * MONEY_LOW_SHARE;
}

export type LookTone = 'red' | 'yellow' | 'blue';

export interface LookItem {
  key: string;
  tone: LookTone;
  title: string;
  detail: string;
  /** A suspended account that asked to be resumed: the row has a Resume button. */
  resume?: { account: AdminAccount; text: string };
}

const listOf = (accounts: readonly AdminAccount[], part: (account: AdminAccount) => string) =>
  accounts.map(part).join(' · ');

const accountsWord = (n: number) => `${n} ${n === 1 ? 'account' : 'accounts'}`;

/** When the UTC day's AI limits start again, in the viewer's own time: "5:30 AM". */
function nextUtcDay(now: Date) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return format(next, 'h:mm a');
}

function resumeItems(accounts: readonly AdminAccount[]): LookItem[] {
  return accounts.flatMap((account) => {
    const request = account.suspension?.request;
    if (!account.suspension || !request) return [];
    return [
      {
        key: `resume-${account.id}`,
        tone: 'blue' as const,
        title: 'Resume request',
        detail: `${account.email}, suspended ${dayLabel(account.suspension.suspendedAt)}, sent ${whenLabel(request.sentAt)}`,
        resume: { account, text: request.text },
      },
    ];
  });
}

function freeAIItems(overview: AdminOverview, money: AdminFreeAIMoney | undefined): LookItem[] {
  const items: LookItem[] = overview.freeAIPauses.map((pause) => ({
    key: `pause-${pause.model}`,
    tone: 'red',
    title: 'Free AI paused for everyone',
    detail: `${modelName(FREE_AI, pause.model)}: ${PAUSE_REASON[pause.reason]}. Tries again at ${format(new Date(pause.resumesAt), 'h:mm a')}. Mails wait and are not lost.`,
  }));
  if (money?.state === 'OK' && moneyLow(money))
    items.push({
      key: 'money',
      tone: 'yellow',
      title: 'Free AI money low',
      detail: `${usd(money.leftUsd ?? 0)} left of ${usd(money.limitUsd ?? 0)}. When it runs out, the free AI stops for everyone.`,
    });
  return items;
}

function gmailItem(accounts: readonly AdminAccount[]): LookItem[] {
  const failing = accounts.filter(
    (account) => account.gmail.state === 'SYNC_FAILING' || account.gmail.state === 'ACCESS_REMOVED',
  );
  if (!failing.length) return [];
  return [
    {
      key: 'gmail',
      tone: 'red',
      title: `Gmail sync failing · ${accountsWord(failing.length)}`,
      detail: listOf(
        failing,
        (account) =>
          `${account.email} (${account.gmail.state === 'SYNC_FAILING' ? 'sync failed' : 'access removed in Google'})`,
      ),
    },
  ];
}

function aiItems(accounts: readonly AdminAccount[], now: Date): LookItem[] {
  const items: LookItem[] = [];
  const unread = accounts.filter((account) => account.aiFailedLast24h > 0);
  const unreadTotal = unread.reduce((sum, account) => sum + account.aiFailedLast24h, 0);
  if (unread.length)
    items.push({
      key: 'unread',
      tone: 'yellow',
      title: `AI could not read ${count(unreadTotal)} ${unreadTotal === 1 ? 'mail' : 'mails'}`,
      detail: `Last 24 hours · ${listOf(unread, (account) => `${account.email} (${account.aiFailedLast24h})`)}`,
    });
  const keys = accounts.filter((account) => account.ai.keyProblem);
  if (keys.length)
    items.push({
      key: 'keys',
      tone: 'yellow',
      title: `Own AI key problem · ${accountsWord(keys.length)}`,
      detail: listOf(
        keys,
        (account) =>
          `${account.email}: ${aiLabel(account)} ${KEY_PROBLEM[account.ai.keyProblem!].toLowerCase()}`,
      ),
    });
  const limited = accounts.filter(
    (account) => account.limitsReached.ai || account.limitsReached.replies,
  );
  if (limited.length)
    items.push({
      key: 'limits',
      tone: 'yellow',
      title: `Daily limit reached · ${accountsWord(limited.length)}`,
      detail: listOf(limited, (account) =>
        account.limitsReached.ai
          ? `${account.email}: ${count(account.aiDailyLimit)} AI calls today. Starts again at ${nextUtcDay(now)}.`
          : `${account.email}: reply limit for the last 24 hours`,
      ),
    });
  return items;
}

/** Everything that needs the owner now, most urgent first; empty means "All good". */
export function needsALook(
  overview: AdminOverview,
  money: AdminFreeAIMoney | undefined,
  now = new Date(),
): LookItem[] {
  return [
    ...resumeItems(overview.accounts),
    ...freeAIItems(overview, money),
    ...gmailItem(overview.accounts),
    ...aiItems(overview.accounts, now),
  ];
}
