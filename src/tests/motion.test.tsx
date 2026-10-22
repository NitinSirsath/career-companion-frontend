/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { AutoHeight } from '../components/ui/auto-height';
import { Collapse } from '../components/ui/collapse';
import { Reveal } from '../components/ui/reveal';

function NoteSection() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        Show the AI note
      </button>
      <Collapse open={open}>
        <p>The AI's note</p>
      </Collapse>
    </>
  );
}

describe('Collapse', () => {
  afterEach(cleanup);

  it('shows and hides its content, and the toggle says which', async () => {
    render(<NoteSection />);
    const toggle = screen.getByRole('button', { name: 'Show the AI note' });
    expect(screen.queryByText("The AI's note")).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText("The AI's note")).toBeVisible();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(screen.queryByText("The AI's note")).not.toBeInTheDocument());
  });
});

describe('Reveal', () => {
  afterEach(cleanup);

  it('shows its content inside a box that grows in', () => {
    render(
      <Reveal>
        <p>Company name is required</p>
      </Reveal>,
    );
    const text = screen.getByText('Company name is required');
    expect(text).toBeVisible();
    expect(text.parentElement?.parentElement).toHaveClass('animate-reveal');
  });
});

describe('AutoHeight', () => {
  const proto = HTMLElement.prototype as HTMLElement & Record<string, unknown>;
  const saved = {
    animate: proto.animate,
    getAnimations: proto.getAnimations,
    offsetHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight'),
    matchMedia: window.matchMedia,
  };
  let contentHeight = 100;
  let resized = () => {};
  let reduceMotion = false;
  let innerAnimations: Animation[] = [];
  const animate = vi.fn(() => ({ cancel: vi.fn(), onfinish: null }) as unknown as Animation);

  beforeEach(() => {
    contentHeight = 100;
    reduceMotion = false;
    innerAnimations = [];
    animate.mockClear();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resized = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    proto.animate = animate;
    proto.getAnimations = () => innerAnimations;
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get: () => contentHeight,
    });
    window.matchMedia = ((query: string) => ({ matches: reduceMotion, media: query })) as never;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    proto.animate = saved.animate;
    proto.getAnimations = saved.getAnimations;
    if (saved.offsetHeight)
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', saved.offsetHeight);
    window.matchMedia = saved.matchMedia;
  });

  function renderBox() {
    render(
      <AutoHeight>
        <p>Results</p>
      </AutoHeight>,
    );
    return screen.getByText('Results').parentElement!.parentElement!;
  }

  it('moves from the old height to the new one when its content jumps', () => {
    const box = renderBox();
    contentHeight = 160;
    resized();
    expect(animate).toHaveBeenCalledWith(
      [{ height: '100px' }, { height: '160px' }],
      expect.objectContaining({ duration: 240 }),
    );
    expect(box.style.overflow).toBe('hidden');
  });

  it('follows a part inside that already animates its own height', () => {
    renderBox();
    innerAnimations = [
      {
        playState: 'running',
        effect: { getKeyframes: () => [{ height: '0px' }] },
      } as unknown as Animation,
    ];
    contentHeight = 160;
    resized();
    expect(animate).not.toHaveBeenCalled();
  });

  it('does not animate when the computer asks for reduced motion', () => {
    reduceMotion = true;
    renderBox();
    contentHeight = 160;
    resized();
    expect(animate).not.toHaveBeenCalled();
  });
});
