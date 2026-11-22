import { noMotion, onReplay, whenSeen } from './motion.ts';

/*
 * The NorthList Apply page's self-playing run picture (owner, 7 Nov 2026; new look 19-20 Nov). It plays when it
 * comes into view and has a replay button under it; nothing beside it moves while it plays.
 */

/*
 * Automation page (owner, 7 Nov 2026): the visitor's AI app applies to one job while NorthList sits beside
 * it. Chat lines appear by `data-at` (ms); a step shows grey shimmer (`data-work`, for `data-for` ms), then
 * its result. The browser follows: the job page, the apply dialog filled in field by field, the sent page.
 * Last, the job arrives at the top of NorthList's Submitted list with a short notice. While it plays, the
 * stage makes one slow move (`rolling`: both windows rise a little). The switcher (a tab list) gives the
 * window another app's look and plays the run again. The HTML holds the end state, as Antigravity; this
 * rewinds it.
 */
const RUN_TIMES = {
  roll: 40,
  drive: 500,
  job: 800,
  apply: 2100,
  form: 2400,
  field: 2700,
  fieldGap: 480,
  submit: 5050,
  sent: 5350,
  undrive: 5900,
  arrive: 6850,
  idle: 7300,
  noteOff: 9000,
};
const RUN_WORDS = ['title', 'ph', 'model', 'drive'] as const;

/** The run picture's parts, and small helpers to set them. */
function runParts(demo: HTMLElement, app: HTMLElement, row: HTMLElement, page: HTMLElement) {
  const one = (sel: string) => demo.querySelector<HTMLElement>(sel);
  const steps = [...demo.querySelectorAll<HTMLElement>('.log [data-at]')];
  const pages = [...demo.querySelectorAll<HTMLElement>('[data-pg]')];
  const fields = [...demo.querySelectorAll<HTMLElement>('.fld .in')];
  const words = fields.map((f) => f.querySelector('.v')?.textContent ?? '');
  const prog = one('[data-run="prog"]');
  const note = one('[data-run="note"]');
  const chip = one('[data-run="chip"]');
  const stage = one('[data-run="stage"]');
  for (const st of steps) {
    if (!st.dataset.work) continue;
    const wk = document.createElement('span');
    wk.className = 'wk shimmer';
    wk.textContent = st.dataset.work;
    st.querySelector('.t')?.after(wk);
  }
  return {
    one, app, row, page, stage, steps, fields, words, prog, note,
    show: (name: string | null) => pages.forEach((p) => p.classList.toggle('on', p.dataset.pg === name)),
    fill: (i: number, text: string) => {
      const v = fields[i].querySelector('.v');
      if (v) v.textContent = text;
    },
    press: (sel: string) => {
      const b = one(sel);
      if (!b) return;
      b.classList.remove('press');
      void b.offsetWidth;
      b.classList.add('press');
    },
    setChip: (busy: boolean, text: string) => {
      chip?.classList.toggle('idle', !busy);
      const t = chip?.querySelector('span');
      if (t) t.textContent = text;
    },
  };
}
type RunParts = ReturnType<typeof runParts>;

/** Puts the picture at its end state (`done`), or rewinds it to its start. */
function runAt(r: RunParts, done: boolean): void {
  for (const st of r.steps) {
    st.classList.remove('show', 'working');
    st.classList.toggle('pending', !done);
  }
  r.fields.forEach((f, i) => {
    f.classList.remove('focus');
    r.fill(i, done ? r.words[i] : '');
  });
  if (r.prog) r.prog.style.width = done ? '100%' : '0%';
  r.row.classList.remove('arrive');
  r.row.classList.toggle('pending', !done);
  r.note?.classList.remove('on');
  r.show(done ? 'sent' : null);
  r.page.classList.remove('driving');
  r.stage?.classList.remove('rolling');
  r.stage?.classList.toggle('still', done);
  r.setChip(!done, done ? 'Next job in 30 sec' : 'Job 2 of 10');
}

/** Plans every change of one run with `later` (ms from the start). */
function runPlan(r: RunParts, later: (ms: number, fn: () => void) => void): void {
  for (const st of r.steps) {
    const at = Number(st.dataset.at) || 0;
    const work = st.dataset.work ? Number(st.dataset.for) || 900 : 0;
    later(at, () => {
      st.classList.remove('pending');
      st.classList.add('show');
      st.classList.toggle('working', work > 0);
    });
    if (work) later(at + work, () => st.classList.remove('working'));
  }
  const t = RUN_TIMES;
  later(t.roll, () => r.stage?.classList.add('rolling'));
  later(t.drive, () => r.page.classList.add('driving'));
  later(t.job, () => r.show('job'));
  later(t.apply, () => r.press('[data-run="apply"]'));
  later(t.form, () => r.show('form'));
  r.fields.forEach((f, i) => {
    const at = t.field + i * t.fieldGap;
    const text = r.words[i];
    later(at, () => {
      r.fields.forEach((x) => x.classList.remove('focus'));
      f.classList.add('focus');
      if (r.prog) r.prog.style.width = `${((i + 1) / r.fields.length) * 100}%`;
    });
    if (f.hasAttribute('data-file')) later(at + 200, () => r.fill(i, text));
    else
      for (let c = 1; c <= text.length; c++)
        later(at + 40 + c * Math.min(45, 320 / text.length), () => r.fill(i, text.slice(0, c)));
  });
  later(t.field + r.fields.length * t.fieldGap + 60, () =>
    r.fields.forEach((x) => x.classList.remove('focus')),
  );
  later(t.submit, () => r.press('[data-run="submit"]'));
  later(t.sent, () => r.show('sent'));
  later(t.undrive, () => r.page.classList.remove('driving'));
  later(t.arrive, () => {
    r.row.classList.remove('pending');
    void r.row.offsetWidth;
    r.row.classList.add('arrive');
    r.note?.classList.add('on');
  });
  later(t.idle, () => r.setChip(false, 'Next job in 30 sec'));
  later(t.noteOff, () => r.note?.classList.remove('on'));
}

/* The switcher: a tab list (arrow keys, Home, End). Another app's look and words, then the run again. */
function runSwitcher(r: RunParts, demo: HTMLElement, play: () => void): void {
  const tabs = [...demo.querySelectorAll<HTMLButtonElement>('.pick [role="tab"]')];
  const notes = [...demo.querySelectorAll<HTMLElement>('[data-note]')];
  const pick = (tab: HTMLButtonElement) => {
    const name = tab.dataset.app ?? 'ag';
    r.app.dataset.app = name;
    for (const b of tabs) {
      b.setAttribute('aria-selected', String(b === tab));
      b.tabIndex = b === tab ? 0 : -1;
    }
    for (const n of notes) n.hidden = n.dataset.note !== name;
    for (const key of RUN_WORDS) {
      const el = r.one(`[data-run="${key}"]`);
      if (el) el.textContent = tab.dataset[key] ?? '';
    }
    play();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      if (tab.getAttribute('aria-selected') !== 'true') pick(tab);
    });
    tab.addEventListener('keydown', (e) => {
      const keys: Record<string, number> = {
        ArrowRight: (i + 1) % tabs.length,
        ArrowLeft: (i - 1 + tabs.length) % tabs.length,
        Home: 0,
        End: tabs.length - 1,
      };
      const to = keys[e.key] ?? -1;
      if (to < 0) return;
      e.preventDefault();
      tabs[to].focus();
      pick(tabs[to]);
    });
  });
}

function automationRun(demo: HTMLElement): void {
  const app = demo.querySelector<HTMLElement>('.aw');
  const row = demo.querySelector<HTMLElement>('[data-newrow]');
  const page = demo.querySelector<HTMLElement>('[data-run="page"]');
  if (!app || !row || !page) return;
  const r = runParts(demo, app, row, page);
  let timers: number[] = [];
  const stop = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };
  const play = () => {
    stop();
    runAt(r, noMotion);
    if (!noMotion) runPlan(r, (ms, fn) => timers.push(window.setTimeout(fn, ms)));
  };
  runSwitcher(r, demo, play);
  if (!noMotion) runAt(r, false);
  whenSeen(
    demo,
    (still) => {
      if (still) runAt(r, true);
      else play();
    },
    0.35,
  );
  onReplay('run', play);
}

export function startPictures(): void {
  document.querySelectorAll<HTMLElement>('[data-rundemo]').forEach(automationRun);
}
