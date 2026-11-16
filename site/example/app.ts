import { appIcon as I } from '../parts/appIcons.ts';
import { noMotion, whenSeen } from '../runtime/motion.ts';
import { NEW_MAIL, startState, type Mail, type State, type View } from './data.ts';
import { laptop } from './laptop.ts';
import { phone, type Enter } from './phone.ts';
import { esc } from './pieces.ts';

const wait = (ms: number) => new Promise((r) => setTimeout(r, noMotion ? Math.min(ms, 30) : ms));

interface Options {
  view?: View;
  /** Always the phone layout (the phone section), whatever the width. */
  phone?: boolean;
  /** 'sync': a moment after it is seen, Gmail is checked and a new job mail arrives, once. */
  autoplay?: string | null;
}

/**
 * A working example of NorthList with made-up mails: open a mail, reply, let the AI write the draft,
 * send it, sync. Nothing leaves the page. A tap, a key or keyboard focus inside means the visitor is
 * using it: the autoplay stops, and from then on a swipe scrolls its list. Before that, a swipe over it
 * scrolls the page (`.used`, see the styles).
 */
export class SampleApp {
  readonly root: HTMLElement;
  s: State;
  mode: 'phone' | 'mid' | 'wide' = 'wide';
  touched = false;
  private readonly initialView: View;
  private readonly forcePhone: boolean;
  private readonly autoplay: string | null;
  /** Bumped by reset(), so steps of an older run stop. */
  private run = 0;
  private lastView = '';
  /** What was open at the last drawing, so a new page slides in and a new sheet rises only once. */
  private lastPage = '';
  private lastSheet = '';
  private toastTimer = 0;
  /** The build-in (the hero only): the parts wait hidden, then appear one by one. */
  private building = false;
  private buildTimer = 0;
  private built: Promise<void> = Promise.resolve();
  private builtDone = () => {};

  constructor(root: HTMLElement, opts: Options = {}) {
    this.root = root;
    this.initialView = opts.view ?? 'mails';
    this.s = startState(this.initialView);
    this.forcePhone = !!opts.phone;
    this.autoplay = opts.autoplay ?? null;
    root.classList.add('sa');
    const use = () => {
      this.touched = true;
      root.classList.add('used');
    };
    for (const t of ['click', 'keydown', 'focusin']) root.addEventListener(t, use, true);
    root.addEventListener('click', (e) => this.click(e.target as Element));
    root.addEventListener('keydown', (e) => this.key(e));
    root.addEventListener('input', (e) => this.input(e.target as HTMLElement));
    // Phones: once the big title scrolls under the round buttons, the small title shows in the middle.
    root.addEventListener('scroll', (e) => this.scrolled(e.target as Element), true);
    this.measure();
    new ResizeObserver(() => {
      if (this.measure()) this.render();
    }).observe(root);
    this.render();
    // Starts once half of it is in view, or less on short screens where half never fits.
    const seen = Math.min(0.5, (0.8 * innerHeight) / Math.max(1, root.getBoundingClientRect().height));
    if (this.autoplay) whenSeen(root, (still) => !still && this.play(), seen);
  }

  /** Phone layout under 620 px of its own width, a narrower table under 940 px. */
  private measure(): boolean {
    const w = this.root.clientWidth;
    let mode: SampleApp['mode'] = w < 940 ? 'mid' : 'wide';
    if (this.forcePhone || w < 620) mode = 'phone';
    const changed = mode !== this.mode;
    this.mode = mode;
    this.root.classList.toggle('mid', mode === 'mid');
    return changed;
  }

  mail(id = this.s.mailId): Mail | undefined {
    return this.s.mails.find((m) => m.id === id);
  }

  private set(patch: Partial<State>): void {
    Object.assign(this.s, patch);
    this.render();
  }

  private toast(text: string): void {
    let t = this.root.querySelector('.toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'toast';
      this.root.appendChild(t);
    }
    t.innerHTML = `${I('check', 14)} ${esc(text)}`;
    const shown = t;
    requestAnimationFrame(() => shown.classList.add('show'));
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => shown.classList.remove('show'), 2400);
  }

  /* ---------- What the visitor does ---------- */
  private click(target: Element): void {
    // A tap anywhere outside an open menu closes it, as a phone does.
    if (this.s.menu && !target.closest('.sa-menu, [data-menu]')) return this.set({ menu: null });
    const menu = target.closest<HTMLElement>('[data-menu]');
    if (menu) return this.set({ menu: this.s.menu ? null : 'filters' });
    const go = target.closest<HTMLElement>('[data-go]');
    if (go) return this.set({ view: go.dataset.go as View, reply: null, mailId: null, sheet: null });
    const open = target.closest<HTMLElement>('[data-open]');
    if (open) return this.open(open.dataset.open ?? '');
    const soon = target.closest<HTMLElement>('[data-soon]');
    if (soon) return this.toast(soon.dataset.soon || 'Settings are in the real app, not in this example');
    const act = target.closest<HTMLButtonElement>('[data-act]');
    if (act && !act.disabled) this.act(act.dataset.act ?? '');
    if (target.closest('[data-ai]')) void this.write();
  }

  /** What each `data-act` button does. */
  private readonly actions: Record<string, () => void> = {
    sync: () => void this.sync(),
    reply: () => this.startReply(false),
    aireply: () => this.startReply(true),
    cancel: () => this.set({ reply: null }),
    send: () => void this.send(),
    back: () => this.set({ view: 'mails', mailId: null, reply: null, sheet: null }),
    did: () => this.did(),
    reopen: () => this.reopen(),
    info: () => this.set({ sheet: 'info' }),
    step: () => this.set({ sheet: 'step' }),
    showmail: () => this.showMail(),
    closesheet: () => this.set({ sheet: null }),
    needs: () => this.set({ needsOnly: !this.s.needsOnly, menu: null }),
    new: () => this.set({ newOnly: !this.s.newOnly, menu: null }),
  };

  private act(a: string): void {
    this.actions[a]?.();
  }

  /** Opens the reply. "AI reply" (phones) puts the cursor in the hint; the laptop hero scrolls down to the box. */
  private startReply(ai: boolean): void {
    this.set({ reply: { text: '', writing: false } });
    if (ai) return this.root.querySelector<HTMLElement>('.sa-hint')?.focus({ preventScroll: true });
    const pane = this.root.closest('.sa-fit') && this.root.querySelector('.sa-main');
    if (pane) pane.scrollTop = pane.scrollHeight;
  }

  private key(e: KeyboardEvent): void {
    const t = e.target as HTMLElement;
    if (e.key === 'Enter' && t.matches('[data-open]')) this.open(t.dataset.open ?? '');
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && t.matches('.sa-ta')) void this.send();
    if (e.key === 'Enter' && t.matches('.sa-hint')) {
      e.preventDefault();
      void this.write();
    }
  }

  private input(t: HTMLElement): void {
    if (!(t instanceof HTMLTextAreaElement) || !t.matches('.sa-ta') || !this.s.reply) return;
    this.s.reply.text = t.value;
    const b = this.root.querySelector<HTMLButtonElement>('[data-act="send"]');
    if (b) b.disabled = !t.value.trim();
  }

  open(id: string): void {
    const m = this.mail(id);
    if (!m) return;
    m.isNew = false;
    this.set({ view: 'mail', mailId: id, reply: null, sheet: null, menu: null });
    const main = this.root.querySelector('.sa-main, .sa-pmain');
    if (main) main.scrollTop = 0;
  }

  /** Back to the start, for the replay button: a swipe scrolls the page again, the list is at its top. */
  reset(): void {
    this.run += 1;
    this.touched = false;
    clearTimeout(this.toastTimer);
    this.root.querySelector('.toast')?.classList.remove('show');
    this.s = startState(this.initialView);
    this.root.classList.remove('used');
    this.lastView = '';
    this.lastPage = '';
    this.lastSheet = '';
    this.render();
  }

  /*
   * Build-in (the hero only, styles/states.css "Hero build-in"): holdBuild() hides the app's parts,
   * playBuild() lets them appear one by one, endBuild() shows everything. Any redraw ends it at once.
   */
  holdBuild(): void {
    if (this.building) return;
    this.building = true;
    this.root.classList.add('sa-build');
    this.built = new Promise((r) => (this.builtDone = r));
  }

  playBuild(): void {
    if (!this.building || this.buildTimer) return;
    this.root.classList.add('sa-build-go');
    // The parts take 1.84 s on a phone and 1.9 s on the laptop picture.
    this.buildTimer = window.setTimeout(() => this.endBuild(), 2000);
  }

  endBuild(): void {
    if (!this.building) return;
    clearTimeout(this.buildTimer);
    this.building = false;
    this.buildTimer = 0;
    this.root.classList.remove('sa-build', 'sa-build-go');
    this.builtDone();
  }

  /** The self-playing part: a moment after it is seen, and after any build-in, Gmail is checked and a new job mail arrives. */
  play(): void {
    if (this.autoplay !== 'sync') return;
    const run = this.run;
    const waits = this.building;
    void (waits ? this.built : Promise.resolve()).then(() => {
      setTimeout(() => {
        if (run === this.run && !this.touched) void this.sync();
      }, waits ? 900 : 1400);
    });
  }

  private async sync(): Promise<void> {
    if (this.s.syncing) return;
    const run = this.run;
    this.set({ syncing: true });
    await wait(1200);
    if (run !== this.run) return;
    if (this.s.synced) {
      this.set({ syncing: false, syncedAt: 'just now' });
      return this.toast('No new job mails');
    }
    const m: Mail = { ...structuredClone(NEW_MAIL), reading: true, fresh: true };
    this.s.mails.unshift(m);
    this.set({ syncing: false, synced: true, reading: true, syncedAt: 'just now' });
    setTimeout(() => (m.fresh = false), 1200); // the new row is tinted once, on arrival
    await wait(1800);
    if (run !== this.run) return;
    m.reading = false;
    this.s.reading = false;
    const app = this.s.apps.find((x) => x.co === m.company);
    if (app && m.app)
      Object.assign(app, { status: m.app.status, todo: m.step, due: m.due, last: `Mail from ${m.from} · Just now`, mail: m.id });
    this.render();
  }

  /** "Write with AI": a grey shimmer, then the draft types itself in. */
  private async write(): Promise<void> {
    const m = this.mail();
    const r = this.s.reply;
    if (!m || !r || r.writing) return;
    const run = this.run;
    r.writing = true;
    this.render();
    await wait(1500);
    if (run !== this.run || this.s.reply !== r) return;
    r.writing = false;
    r.text = '';
    this.render();
    const ta = this.root.querySelector<HTMLTextAreaElement>('.sa-ta');
    const full = m.draft ?? `Hi ${m.from.split(' ')[0]},\n\nThank you for your mail. \n\nBest regards,\nAlex`;
    for (let n = 0; !noMotion && n <= full.length; n += 3) {
      if (run !== this.run || this.s.reply !== r || !ta?.isConnected) return;
      r.text = full.slice(0, n);
      ta.value = r.text;
      await new Promise((ok) => setTimeout(ok, 16));
    }
    r.text = full;
    if (ta) ta.value = full;
    const b = this.root.querySelector<HTMLButtonElement>('[data-act="send"]');
    if (b) b.disabled = false;
  }

  /** "I did this" (Done on a phone), for a step the visitor finished somewhere else (a test link). */
  private did(): void {
    const m = this.mail();
    if (!m) return;
    Object.assign(m, { state: 'DONE', checking: false, closed: 'You said you did it' });
    const app = this.s.apps.find((x) => x.mail === m.id);
    if (app) app.todo = '';
    this.render();
    this.toast(`Done: ${m.step}`);
  }

  /** Reopen: one word puts any closed step back on the list, as in the app (owner, 13 Nov 2026). */
  private reopen(): void {
    const m = this.mail();
    if (!m) return;
    Object.assign(m, { state: 'OPEN', checking: false, closed: undefined, note: undefined });
    const app = this.s.apps.find((x) => x.mail === m.id);
    if (app) app.todo = m.step;
    this.render();
    this.toast(`Reopened: ${m.step}`);
  }

  /** From the step's sheet to the mail that asked: the sheet closes and the page scrolls to that mail. */
  private showMail(): void {
    this.set({ sheet: null });
    const main = this.root.querySelector<HTMLElement>('.sa-pmain');
    const mails = [...this.root.querySelectorAll<HTMLElement>('.sa-pmsg:not(.you)')];
    const target = this.root.querySelector<HTMLElement>('.sa-pmsg .tag-yellow')?.closest<HTMLElement>('.sa-pmsg') ?? mails[mails.length - 1];
    if (main && target) main.scrollTop = target.offsetTop - 60;
  }

  /** The small title in the middle of the phone's top shows once the big title has scrolled under it. */
  private scrolled(el: Element): void {
    if (!el.matches?.('.sa-pmain')) return;
    el.closest('.sa-p')?.classList.toggle('scrolled', el.scrollTop > 36);
  }

  /** Send: "Sent from your Gmail", the step turns Replied, then the AI reads the reply and closes it. */
  private async send(): Promise<void> {
    const m = this.mail();
    const r = this.s.reply;
    if (!m || !r || !r.text.trim() || r.sending) return;
    const run = this.run;
    r.sending = true;
    this.render();
    await wait(700);
    if (run !== this.run) return;
    m.thread.push({ you: true, from: 'You', email: 'alex.morgan@gmail.example', when: 'Just now', body: r.text.trim() });
    if (m.state === 'OPEN' && !m.fake) Object.assign(m, { state: 'REPLIED', checking: true, repliedAt: 'just now' });
    this.set({ reply: null });
    this.toast('Sent from your Gmail');
    await wait(1900);
    if (run !== this.run || !m.checking) return;
    m.checking = false;
    const app = this.s.apps.find((a) => a.mail === m.id);
    if (app) app.last = 'You replied · Just now';
    if (m.how === 'link') m.note = 'Your reply did not finish the test. Mark it done when you have.';
    else {
      Object.assign(m, { state: 'DONE', closed: 'Your reply answered it' });
      if (app) app.todo = '';
    }
    this.render();
  }

  /* ---------- Drawing ---------- */
  /** Draws the current state, keeping the list's scroll place and keyboard focus. */
  render(): void {
    if (this.building) this.endBuild(); // new parts would start the build-in again
    const s = this.s;
    const main = this.root.querySelector('.sa-main, .sa-pmain');
    const keep = main && this.lastView === s.view + s.mailId ? main.scrollTop : 0;
    const focus = this.focused();
    const toast = this.root.querySelector('.toast');
    const m = s.view === 'mail' ? (this.mail() ?? null) : null;
    this.root.innerHTML = this.mode === 'phone' ? phone(s, m, this.motion(m)) : laptop(s, m);
    if (toast) this.root.appendChild(toast);
    const nm = this.root.querySelector('.sa-main, .sa-pmain');
    if (nm && keep) nm.scrollTop = keep;
    if (nm) this.scrolled(nm);
    this.lastView = s.view + s.mailId;
    this.refocus(focus);
  }

  /** Phones: a mail slides in from the right and back out; a sheet rises once, when it opens. */
  private motion(m: Mail | null): Enter {
    const page = m ? `mail:${m.id}` : this.s.view;
    const sheet = this.s.reply ? 'reply' : (this.s.sheet ?? '');
    let enter: Enter = '';
    if (sheet && sheet !== this.lastSheet) enter = 'sheet';
    else if (this.lastPage && page !== this.lastPage && m) enter = 'push';
    else if (this.lastPage.startsWith('mail:') && !m) enter = 'pop';
    this.lastPage = page;
    this.lastSheet = sheet;
    return enter;
  }

  /** Where keyboard focus is inside the example: the reply text, or a control to find again after drawing. */
  private focused(): string {
    const a = document.activeElement;
    if (!a || !this.root.contains(a)) return '';
    if (a.matches('.sa-ta')) return '.sa-ta';
    const k = ['data-act', 'data-go', 'data-open', 'data-ai'].find((name) => a.hasAttribute(name));
    return k ? `[${k}="${a.getAttribute(k)}"]` : '';
  }

  private refocus(selector: string): void {
    const el = selector ? this.root.querySelector<HTMLElement>(selector) : null;
    if (!el || (el instanceof HTMLButtonElement && el.disabled)) return;
    if (el instanceof HTMLTextAreaElement) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    } else el.focus({ preventScroll: true });
  }
}
