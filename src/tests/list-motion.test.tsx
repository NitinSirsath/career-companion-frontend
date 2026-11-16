// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEAVE_MS, useListMotion } from '../components/ui/useListMotion';

const keyOf = (item: string) => item;
const shown = (entries: { key: string; phase: string }[]) =>
  entries.map((entry) => `${entry.key}:${entry.phase}`);

interface Props {
  items: string[];
  listKey: string | undefined;
}

function setup(items: string[], listKey: string | undefined = 'list', growFirst = false) {
  const initialProps: Props = { items, listKey };
  return renderHook((props: Props) => useListMotion(props.items, keyOf, props.listKey, growFirst), {
    initialProps,
  });
}

describe('useListMotion', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('draws the first list at once', () => {
    const { result } = setup(['a', 'b']);
    expect(shown(result.current)).toEqual(['a:stay', 'b:stay']);
  });

  it('keeps a leaving row where it was, then drops it', () => {
    const { result, rerender } = setup(['a', 'b', 'c']);
    rerender({ items: ['a', 'c'], listKey: 'list' });
    expect(shown(result.current)).toEqual(['a:stay', 'b:leave', 'c:stay']);
    act(() => vi.advanceTimersByTime(LEAVE_MS));
    expect(shown(result.current)).toEqual(['a:stay', 'c:stay']);
  });

  it('grows a new row in, and keeps the first row leaving at the top', () => {
    const { result, rerender } = setup(['a', 'b']);
    rerender({ items: ['b', 'n'], listKey: 'list' });
    expect(shown(result.current)).toEqual(['a:leave', 'b:stay', 'n:enter']);
  });

  it('draws a new list (another filter or page) at once', () => {
    const { result, rerender } = setup(['a', 'b']);
    rerender({ items: ['x', 'y'], listKey: 'other' });
    expect(shown(result.current)).toEqual(['x:stay', 'y:stay']);
  });

  it('does not grow rows in when the list was empty, unless asked (filter pills)', () => {
    const list = setup([]);
    list.rerender({ items: ['a'], listKey: 'list' });
    expect(shown(list.result.current)).toEqual(['a:stay']);
    const pills = setup([], 'pills', true);
    pills.rerender({ items: ['a'], listKey: 'pills' });
    expect(shown(pills.result.current)).toEqual(['a:enter']);
  });

  it('does not start again when only the array changes, and moves nothing without a key', () => {
    const { result, rerender } = setup(['a', 'b']);
    rerender({ items: ['a', 'b'], listKey: 'list' });
    expect(shown(result.current)).toEqual(['a:stay', 'b:stay']);
    const still = setup(['a', 'b'], undefined);
    still.rerender({ items: ['a'], listKey: undefined });
    expect(shown(still.result.current)).toEqual(['a:stay']);
  });
});
