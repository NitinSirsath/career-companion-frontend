import { useEffect, useState } from 'react';
import { READING_POLL_MS, useAIReading } from '../../api/aiReading';
import type { AIReadingStatusResponse } from '../../contracts/ai';
import {
  DONE_WORDS,
  NO_PLAYBACK,
  showNext,
  statusWords,
  takeAnswer,
  type Playback,
  type ReadingWords,
  type StepView,
} from '../../lib/aiReading';

/** "Done reading your new mails" shows this long, then the status hides. */
export const DONE_MS = 5_000;
/** The live feed shows a step at least this long, and shorter when many came at once. */
const STEP_MS = 1_200;
const FASTEST_STEP_MS = 400;

export interface ReadingView {
  words: ReadingWords;
  /** The answer the words are about: for "done", the last one while reading. */
  status: AIReadingStatusResponse;
  /** The live feed's line: the AI's step shown now, while mails are read. */
  step: StepView | null;
}

/**
 * The batch that just finished, for 5 seconds after the last answer while reading. Its job mails
 * come from the answer that says nothing waits: it also has those the last mails found.
 */
function useFinishedBatch(data: AIReadingStatusResponse | undefined) {
  const [before, setBefore] = useState(data);
  const [finished, setFinished] = useState<AIReadingStatusResponse | null>(null);
  if (data !== before) {
    setBefore(data);
    if (data?.state === 'NONE' && before?.state === 'READING')
      setFinished({ ...before, jobMails: data.jobMails });
    else if (data && data.state !== 'NONE') setFinished(null);
  }
  useEffect(() => {
    if (!finished) return;
    const timer = setTimeout(() => setFinished(null), DONE_MS);
    return () => clearTimeout(timer);
  }, [finished]);
  return finished;
}

/** The live feed's step shown now: each answer's new steps, one after another. */
function useStepPlayback(data: AIReadingStatusResponse | undefined) {
  const [play, setPlay] = useState<Playback>(NO_PLAYBACK);
  if (data !== play.answer) setPlay(takeAnswer(play, data));
  const { queue, current } = play;
  useEffect(() => {
    if (!queue.length) return;
    const wait = Math.max(FASTEST_STEP_MS, Math.min(STEP_MS, READING_POLL_MS / queue.length));
    const timer = setTimeout(() => setPlay(showNext), current ? wait : 0);
    return () => clearTimeout(timer);
  }, [queue, current]);
  return current;
}

/** What the status shows now, or null when nothing waits and nothing just finished. */
export function useReadingView(): ReadingView | null {
  const { data } = useAIReading();
  const finished = useFinishedBatch(data);
  const step = useStepPlayback(data);
  const words = data && statusWords(data);
  if (data && words) return { words, status: data, step: data.state === 'READING' ? step : null };
  if (finished) return { words: DONE_WORDS, status: finished, step: null };
  return null;
}

const MINIMIZED_KEY = 'career-companion-reading-feed';

/** Whether the live feed is minimized in the side menu; the browser remembers the choice. */
export function useFeedMinimized(): [boolean, (minimized: boolean) => void] {
  const [minimized, setMinimized] = useState(() => {
    try {
      return localStorage.getItem(MINIMIZED_KEY) === 'minimized';
    } catch {
      return false;
    }
  });
  const change = (next: boolean) => {
    setMinimized(next);
    try {
      localStorage.setItem(MINIMIZED_KEY, next ? 'minimized' : 'open');
    } catch {
      // A blocked storage only means the choice is not remembered.
    }
  };
  return [minimized, change];
}
