import { useEffect, useRef, useState } from 'react';

const TYPING_PAUSE_MS = 300;

/**
 * The search box keeps what is typed and passes it on after a short pause, so the list is not
 * read again on every key. When the value changes without typing (Back, Forward), the box
 * shows the new value.
 */
export function useSearchText(value: string, onCommit: (text: string) => void) {
  const [text, setText] = useState(value);
  const committed = useRef(value);
  const commit = useRef(onCommit);
  useEffect(() => {
    commit.current = onCommit;
  });
  useEffect(() => {
    if (value === committed.current) return;
    committed.current = value;
    setText(value);
  }, [value]);
  useEffect(() => {
    if (text === committed.current) return;
    const timer = setTimeout(() => {
      committed.current = text;
      commit.current(text);
    }, TYPING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [text]);
  return [text, setText] as const;
}
