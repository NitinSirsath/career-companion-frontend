/**
 * The last filters and page of each list, so "Back" from a detail page returns to the same view.
 * Kept in memory only: a reload starts from the URL, which already holds them.
 */
const remembered = new Map<string, Record<string, unknown>>();

export type ListPath = '/mails' | '/applications';

export function rememberListSearch(path: ListPath, search: Record<string, unknown>) {
  remembered.set(path, search);
}

export function listSearch<T extends Record<string, unknown>>(path: ListPath): T {
  return (remembered.get(path) ?? {}) as T;
}
