/*
 * "What should I apply to today?", northlist.site/apply/plan (owner, 25 Nov 2026; mock
 * APPLY-TASKS-mock/plan.html). NorthList Apply's AI opens it at `start` (instructions/plan_page.md) in
 * place of the chat question: the user taps sites and numbers, presses Start, and the AI reads the plan
 * back from this page's text. Nothing is sent anywhere. Light by default, with the setup page's switch.
 */
import { icon } from '../setup/views.ts';
import {
  SAMPLES,
  capOf,
  estimate,
  firstNumber,
  floorOf,
  groupsFor,
  itemName,
  planBlock,
  planText,
  planWords,
  readFacts,
  roughTime,
  startPicks,
  storageKey,
  type Counts,
  type Facts,
  type Item,
} from './data.ts';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s);
const params = new URLSearchParams(location.search);
const THEME_KEY = 'nl-apply-theme';
const TICK =
  '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2.5 6.2 2.4 2.3 4.6-5"/></svg>';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function factsOfPage(): Facts {
  const demo = params.get('demo');
  if (location.hash.length > 1 || demo === null) return readFacts(location.hash);
  return readFacts(`#${JSON.stringify(SAMPLES[demo] ?? SAMPLES.last)}`);
}

const facts = factsOfPage();
const KEY = storageKey(facts);
let picks: Counts = startPicks(facts);
let done = false;
let shown = false;

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ picks, done }));
  } catch {
    /* not kept on this computer */
  }
}
function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { picks?: Counts; done?: boolean } | null;
    if (saved?.picks) picks = saved.picks;
    done = saved?.done === true;
  } catch {
    /* start from the last plan */
  }
}

/* ── The plan ───────────────────────────────────────── */
function lead(): string {
  const today = Object.keys(facts.today);
  if (today.length) {
    const parts = Object.entries(facts.last).map(
      ([key, n]) => `${itemName(key)} ${facts.today[key] ?? 0} of ${n}`,
    );
    return `Today so far: <b>${esc(parts.join(', '))}</b>. Keep the plan to go on, or change it. The numbers are for all of today.`;
  }
  if (Object.keys(facts.last).length)
    return `Last time: <b>${esc(planWords(facts.last))}</b>. Tap a site to add or remove it, and set how many jobs.`;
  return 'Tap the sites you want and set how many jobs on each. You can change it every time you start.';
}

function row(item: Item): string {
  const n = picks[item.key] ?? 0;
  const on = n > 0;
  const sent = facts.today[item.key] ?? 0;
  const cap = capOf(item.key, picks, facts);
  const max = Math.min(item.max, facts.limits[item.key] ?? item.max);
  const notes = [
    sent ? `${sent} sent today` : '',
    item.key === 'company_direct' ? 'shares 10 with web search' : '',
    item.key === 'discovery' && facts.careerPages ? 'shares 10 with your career pages' : '',
  ].filter(Boolean);
  const locked = on && sent > 0;
  return `<li>
    <button type="button" class="pick" data-k="${item.key}" aria-pressed="${on}"${locked ? ' aria-disabled="true"' : ''}>
      <span class="box">${TICK}</span>
      <span class="nm"><b>${esc(item.name)}</b>${notes.length ? `<small>${notes.join(' · ')}</small>` : ''}</span>
    </button>
    <span class="stepper"${on ? '' : ' data-off'} role="group" aria-label="${esc(item.name)} jobs">
      <button type="button" data-k="${item.key}" data-d="-1" aria-label="One less" ${on && n > floorOf(item.key, facts) ? '' : 'disabled'}>−</button>
      <output data-out="${item.key}">${n}</output>
      <button type="button" data-k="${item.key}" data-d="1" aria-label="One more" ${on && n < cap ? '' : 'disabled'}>+</button>
    </span>
    <span class="cap">up to ${max}</span>
  </li>`;
}

function renderTotal() {
  const est = estimate(picks, facts);
  const total = $('#total');
  if (!total) return;
  if (!est.jobs) total.innerHTML = '<b>No sites yet</b><small>Tap a site to add it.</small>';
  else {
    const count = Object.keys(facts.today).length
      ? `${est.left} left of ${est.jobs}`
      : `${est.jobs} ${est.jobs === 1 ? 'job' : 'jobs'}`;
    total.innerHTML = `<b>${count} · about ${roughTime(est.minutes)}</b>${
      est.tooLong
        ? `<small class="warn">More than your ${facts.hours}-hour session. What is left waits for your next start.</small>`
        : '<small>A rough guess. Real times show in NorthList after the run.</small>'
    }`;
  }
  const go = $<HTMLButtonElement>('#go');
  if (go) go.disabled = !est.jobs;
  const reset = $('#reset');
  if (reset) reset.hidden = !Object.keys(facts.last).length || planText(picks) === planText(startPicks(facts));
}

function renderPlan() {
  document.title = 'Today’s plan · NorthList Apply';
  $('#foot')!.hidden = false;
  // Only the first paint slides in: a tap must not replay it.
  $('#main')!.innerHTML = `<div class="${shown ? '' : 'pl-enter'}">
    <h1>What should I apply to today?</h1>
    <p class="lead">${lead()}</p>
    ${groupsFor(facts)
      .map(
        (g) =>
          `<section class="pl-group"><h2>${g.title}<small>${g.hint}</small></h2><ul class="rows">${g.items.map(row).join('')}</ul></section>`,
      )
      .join('')}
    <p class="note">Jobs run in this order, top to bottom. Want another order? Write the plan in the chat, like <code>workday 2, linkedin 10</code>.</p>
  </div>`;
  shown = true;
  renderTotal();
}

/* ── Done: the plan the AI reads back ───────────────── */
function renderDone() {
  const text = planText(picks);
  document.title = `Done · ${text}`;
  $('#foot')!.hidden = true;
  const lines = Object.entries(picks)
    .filter(([, n]) => n > 0)
    .map(([key, n]) => {
      const sent = facts.today[key] ?? 0;
      return `<span>${esc(itemName(key))} ${n}${sent ? ` <small>(${sent} already sent)</small>` : ''}</span>`;
    });
  $('#main')!.innerHTML = `<div class="pl-enter pl-done">
    <div class="pl-check">${TICK}</div>
    <h1 tabindex="-1">Your plan is set</h1>
    <p class="lead">Go back to the chat in your AI app. It is reading this plan now, and then shows the check before the run starts.</p>
    <p class="pl-plan">${lines.join('')}</p>
    <p class="lead">Want to change it? Write the new plan in the chat.</p>
    <p class="pl-readback-label">For your AI app</p>
    <pre class="pl-readback">${esc(planBlock(picks))}</pre>
  </div>`;
  $('#main h1')?.focus();
}

function render() {
  if (done) renderDone();
  else renderPlan();
}

/* ── Taps ───────────────────────────────────────────── */
function orderedPicks(next: Counts): Counts {
  // Keep the page's order, so the plan reads top to bottom.
  const order = groupsFor(facts).flatMap((g) => g.items.map((i) => i.key));
  return Object.fromEntries(order.filter((k) => (next[k] ?? 0) > 0).map((k) => [k, next[k]]));
}
function toggle(key: string) {
  if ((picks[key] ?? 0) > 0) {
    if (facts.today[key]) return; // jobs already sent today stay in the plan
    picks = Object.fromEntries(Object.entries(picks).filter(([k]) => k !== key));
  } else {
    const n = firstNumber(key, picks, facts);
    if (n <= 0) return;
    picks = orderedPicks({ ...picks, [key]: n });
  }
}
function step(key: string, by: number) {
  const next = (picks[key] ?? 0) + by;
  if (next < floorOf(key, facts) || next > capOf(key, picks, facts)) return false;
  picks = { ...picks, [key]: next };
  return true;
}

function wire() {
  $('#main')!.addEventListener('click', (e) => {
    if (done) return;
    const target = e.target as HTMLElement;
    const pick = target.closest<HTMLElement>('.pick');
    const stepper = target.closest<HTMLButtonElement>('.stepper button');
    if (pick?.dataset.k) {
      toggle(pick.dataset.k);
      save();
      renderPlan();
      $(`.pick[data-k="${pick.dataset.k}"]`)?.focus();
    } else if (stepper?.dataset.k) {
      const { k, d } = stepper.dataset;
      if (!step(k, Number(d))) return;
      save();
      renderPlan();
      $(`[data-out="${k}"]`)?.classList.add('tick');
      const again = $<HTMLButtonElement>(`.stepper button[data-k="${k}"][data-d="${d}"]`);
      (again && !again.disabled ? again : $(`.pick[data-k="${k}"]`))?.focus();
    }
  });
  $('#reset')!.addEventListener('click', () => {
    picks = startPicks(facts);
    save();
    renderPlan();
  });
  $('#go')!.addEventListener('click', () => {
    if (!planText(picks)) return;
    done = true;
    save();
    renderDone();
    window.scrollTo(0, 0);
  });
}

/* ── Light / dark: light by default, as the setup page ── */
function drawTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  const b = $('#theme');
  if (!b) return;
  b.innerHTML = icon(dark ? 'sun' : 'moon');
  b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
}
function wireTheme() {
  $('#theme')?.addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.dataset.theme !== 'dark';
    root.dataset.theme = dark ? 'dark' : 'light';
    try {
      localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    } catch {
      /* not remembered */
    }
    drawTheme();
  });
  drawTheme();
}

if (params.has('fresh'))
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing kept */
  }
restore();
wire();
wireTheme();
render();
