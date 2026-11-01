/**
 * Privacy page contents: marks the section being read, in the side list (laptops) and in the chip bar
 * (phones), which also scrolls the current chip into view.
 */
export function startToc(smooth: boolean): void {
  if (!document.querySelector('.toc')) return;
  const links = [...document.querySelectorAll('.toc a, .toc-m a')];
  const chips = document.querySelector<HTMLElement>('.toc-m');
  const secs = [...document.querySelectorAll<HTMLElement>('.doc-sec[id]')];
  if (!secs.length) return;
  let lastId = '';
  let queued = false;
  const mark = () => {
    queued = false;
    const line = window.innerHeight * 0.3;
    const cur = secs.filter((s) => s.getBoundingClientRect().top <= line).pop() ?? secs[0];
    links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${cur.id}`));
    const chip = chips?.offsetParent ? chips.querySelector<HTMLElement>(`a[href="#${cur.id}"]`) : null;
    if (chips && chip && cur.id !== lastId)
      chips.scrollTo({ left: chip.offsetLeft - chips.clientWidth / 2 + chip.clientWidth / 2, behavior: smooth ? 'smooth' : 'auto' });
    lastId = cur.id;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(mark);
    },
    { passive: true },
  );
  mark();
}
