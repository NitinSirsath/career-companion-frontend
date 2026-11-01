import { noMotion, onReplay, whenSeen } from './motion.ts';

/*
 * Home's self-playing pictures (owner, 1 Nov 2026). Each plays once when it comes into view and has a
 * replay button under it. Nothing beside them moves while they play: each keeps its finished size.
 */

/** The four steps of an ask light up one after another (under 5 seconds), then rest with a full bar. */
function askSteps(life: HTMLElement): void {
  const steps = [...life.querySelectorAll('.life-step')];
  const bar = life.parentElement?.querySelector<HTMLElement>('.life-bar span');
  let run = 0;
  const setBar = (i: number) => {
    if (bar) bar.style.width = i >= steps.length - 1 ? '100%' : `calc((100% + 24px) * ${(i + 1) / steps.length} - 24px)`;
  };
  const highlight = (i: number) => {
    steps.forEach((st, j) => {
      st.classList.toggle('on', j === i);
      st.classList.toggle('done', j < i);
    });
    setBar(i);
  };
  const rest = () => {
    steps.forEach((st) => {
      st.classList.remove('on');
      st.classList.add('done');
    });
    setBar(steps.length - 1);
  };
  const play = (still: boolean) => {
    const my = ++run;
    if (still) return rest();
    let i = 0;
    highlight(0);
    const next = () => {
      if (my !== run) return;
      i += 1;
      highlight(i);
      if (i < steps.length - 1) setTimeout(next, 1400);
      else setTimeout(() => my === run && rest(), 700);
    };
    setTimeout(next, 1400);
  };
  whenSeen(life, play, 0.4);
  onReplay('life', () => play(false));
}

/*
 * Applications card: a new mail arrives, its row slides into History, and the status moves from
 * Recruiter contact to Interview by itself. The HTML holds the end state; this rewinds it first.
 */
function applicationCard(card: HTMLElement): void {
  const rc = card.querySelector('[data-step="rc"]');
  const iv = card.querySelector('[data-step="iv"]');
  const tag = card.querySelector('[data-apptag]');
  const row = card.querySelector<HTMLElement>('[data-newrow]');
  if (!rc || !iv || !tag || !row || noMotion) return;
  let run = 0;
  const before = () => {
    rc.className = 'now';
    iv.className = 'later';
    tag.className = 'tag tag-cyan';
    tag.textContent = 'Recruiter contact';
    row.classList.remove('arrive');
    row.classList.add('pending');
  };
  const settle = () => {
    rc.className = 'done';
    iv.className = 'now';
    tag.className = 'tag tag-blue';
    tag.textContent = 'Interview';
  };
  const play = (still: boolean) => {
    const my = ++run;
    row.classList.remove('pending');
    if (still) return settle();
    before();
    setTimeout(() => {
      if (my !== run) return;
      row.classList.remove('pending');
      void row.offsetWidth;
      row.classList.add('arrive');
      setTimeout(() => my === run && settle(), 900);
    }, 1000);
  };
  before();
  whenSeen(card, play, 0.45);
  onReplay('app', () => play(false));
}

/** Reply box: the AI writes the draft (grey shimmer, then the text types in), then Send reply turns blue. */
function replyDraft(demo: HTMLElement): void {
  const ed = demo.querySelector<HTMLElement>('.ed');
  const send = demo.querySelector<HTMLButtonElement>('[data-send]');
  if (!ed) return;
  const text = ed.dataset.text ?? '';
  const placeholder = ed.innerHTML;
  let run = 0;
  // Keep the finished draft's height from the start, measured again when the width changes.
  let lastW = 0;
  const size = () => {
    const w = ed.clientWidth;
    if (!w || w === lastW) return;
    lastW = w;
    const cur = ed.innerHTML;
    ed.style.minHeight = '';
    ed.textContent = text;
    ed.style.minHeight = `${ed.offsetHeight}px`;
    ed.innerHTML = cur;
  };
  addEventListener('resize', size);
  const done = () => {
    ed.textContent = text;
    if (send) send.disabled = false;
  };
  const type = (my: number) => {
    let n = 0;
    ed.textContent = '';
    const caret = document.createElement('span');
    caret.className = 'caret';
    const tick = setInterval(() => {
      if (my !== run) return clearInterval(tick);
      n += 2;
      ed.textContent = text.slice(0, n);
      ed.appendChild(caret);
      if (n < text.length) return;
      clearInterval(tick);
      caret.remove();
      done();
    }, 22);
  };
  const play = (still: boolean) => {
    const my = ++run;
    size();
    if (still) return done();
    if (send) send.disabled = true;
    ed.innerHTML = placeholder;
    setTimeout(() => {
      if (my !== run) return;
      ed.innerHTML = '<span class="shimmer">Writing your reply from the whole conversation</span>';
      setTimeout(() => my === run && type(my), 1600);
    }, 500);
  };
  whenSeen(demo, play, 0.4);
  onReplay('reply', () => play(false));
}

export function startPictures(): void {
  document.querySelectorAll<HTMLElement>('[data-life]').forEach(askSteps);
  document.querySelectorAll<HTMLElement>('[data-appdemo]').forEach(applicationCard);
  document.querySelectorAll<HTMLElement>('[data-replydemo]').forEach(replyDraft);
}
