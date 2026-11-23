/* The parts of "Today's run" as HTML: questions, today's report, NorthList and its picture. */
import { esc } from '../setup/data.ts';
import { NL_HOME, NL_SETUP, icon } from '../setup/views.ts';
import { jobsOf, numberUnit, type Answer, type Run, type Waiting } from './data.ts';

const NL_APP = 'https://app.northlist.site/';
const TINTS = ['sage', 'lilac', 'peach', 'sand', 'rose'];
const tint = (s: string) => TINTS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length];
export const tile = (c: string) => `<span class="logo-tile t-${tint(c)}">${esc((c || '?')[0])}</span>`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "23 November", in the user's words; the date as given when it cannot be read. */
export function dayName(date: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }) {
  const d = new Date(`${date}T12:00:00`);
  return Number.isNaN(d.getTime()) ? esc(date) : d.toLocaleDateString('en-GB', opts);
}

/* ── Questions ───────────────────────────────────────── */
function control(w: Waiting, a: Answer): string {
  if (w.kind === 'yesno')
    return `<div class="seg full" role="radiogroup" aria-label="${esc(w.question)}">${['Yes', 'No']
      .map((v) => `<label><input type="radio" name="a-${w.id}" value="${v}"${a.value === v ? ' checked' : ''}>${v}</label>`)
      .join('')}</div>`;
  if (w.kind === 'number') {
    const unit = numberUnit(w.question);
    if (!unit)
      return `<input class="num-box" type="text" inputmode="decimal" data-q="${w.id}" value="${esc(a.value)}" aria-label="${esc(w.question)}" autocomplete="off">`;
    return `<div class="skill"><span>${unit}</span><div class="stepper"><button type="button" data-n="-1" data-q="${w.id}" aria-label="Fewer">${icon('minus')}</button><output>${a.value === '' ? '—' : esc(a.value)}</output><button type="button" data-n="1" data-q="${w.id}" aria-label="More">${icon('plus')}</button></div></div>`;
  }
  if (w.kind === 'choice')
    return `<div class="chips" role="radiogroup" aria-label="${esc(w.question)}">${(w.options ?? [])
      .map((o) => `<label class="chip"><input type="radio" name="a-${w.id}" value="${esc(o)}"${a.value === o ? ' checked' : ''}>${icon('check')}${esc(o)}</label>`)
      .join('')}</div>`;
  const note = w.draft ? `<p class="draft-note">${icon('sparkle')} Drafted from your profile. Change anything.</p>` : '';
  return `<textarea data-q="${w.id}" aria-label="${esc(w.question)}">${esc(a.value)}</textarea>${note}`;
}

function question(w: Waiting, a: Answer): string {
  return `<div class="qitem${a.value.trim() ? ' answered' : ''}" id="card-${esc(w.id)}">
    <p class="qtext">${esc(w.question)}</p>
    ${control(w, a)}
    <div class="qfoot"><span class="ok-mark">${icon('check')} Answered</span>
      <div class="seg" role="radiogroup" aria-label="Use this answer for">
        <label><input type="radio" name="s-${w.id}" value="every"${a.every ? ' checked' : ''}>Every job</label>
        <label><input type="radio" name="s-${w.id}" value="this"${a.every ? '' : ' checked'}>Only ${esc(w.company)}</label>
      </div></div>
  </div>`;
}

/** One card per held job, with each of its questions inside. */
export function questions(run: Run, answers: Record<string, Answer>, answered: number): string {
  const cards = jobsOf(run.waiting)
    .map((job) => {
      const w = job[0];
      return `<div class="qcard"><div class="qjob">${tile(w.company)}<span><b>${esc(w.company)}</b> · ${esc(w.title)} · ${esc(w.site)}</span><span class="qcount">${plural(job.length, 'question')}</span></div>${job.map((x) => question(x, answers[x.id])).join('')}</div>`;
    })
    .join('');
  return `<section class="section"><div class="section-head"><h2>Waiting for you</h2><span id="answered">${answered} of ${run.waiting.length} answered</span></div><div class="qcards">${cards}</div></section>`;
}

/* ── Today's report ──────────────────────────────────── */
export const appliedRows = (run: Run, all: boolean) =>
  (all ? run.applied : run.applied.slice(0, 5))
    .map((a) => `<li>${tile(a.company)}<div><b>${esc(a.company)}</b><span>${esc(a.title)} · ${esc(a.site)}</span></div><em>${esc(a.time)}</em></li>`)
    .join('');

function appliedSection(run: Run): string {
  const n = run.applied.length;
  if (!n) return '';
  const more = n > 5 ? `<button type="button" class="btn btn-plain more" id="show-all">Show all ${n}</button>` : '';
  return `<section class="section"><div class="section-head"><h2>Applied</h2><span>${plural(n, 'job')}</span></div><ul class="list" id="applied-list">${appliedRows(run, false)}</ul>${more}</section>`;
}

function skippedSection(run: Run): string {
  if (!run.skipped.length) return '';
  const rows = run.skipped
    .map((s) => `<li>${tile(s.company)}<div><b>${esc(s.company)}</b><span>${esc(s.title)}</span></div><em class="reason">${esc(s.reason)}</em></li>`)
    .join('');
  return `<section class="section"><div class="section-head"><h2>Skipped</h2><span>so you know why</span></div><ul class="list">${rows}</ul></section>`;
}

export function report(run: Run): string {
  const n = run.applied.length;
  const planned = run.plan.reduce((s, p) => s + p.planned, 0);
  const bars = run.plan
    .map((p) => `<div class="bar-row"><span>${esc(p.site)}</span><div class="track"><div class="fill" style="width:${Math.min(100, Math.round((p.applied / Math.max(1, p.planned)) * 100))}%"></div></div><em>${p.applied} of ${p.planned}</em></div>`)
    .join('');
  const stops = run.stops.length
    ? `<section class="section">${run.stops.map((s) => `<p class="stopline">${icon('alert')}<span><b>${esc(s.site)}</b> stopped for today: ${esc(s.message)}. It tries again at your next run.</span></p>`).join('')}</section>`
    : '';
  return `<section class="section">
      <div class="hero-num"><b data-count="${n}">${n}</b><span>${n === 1 ? 'job' : 'jobs'} applied<br>today, ${dayName(run.date)}</span></div>
      <div class="tiles">
        <div class="tile-n"><b>${planned}</b><span>planned</span></div>
        <div class="tile-n"><b>${run.waiting.length}</b><span>waiting for you</span></div>
        <div class="tile-n"><b>${run.skipped.length}</b><span>skipped</span></div>
        <div class="tile-n"><b>${run.passedOver}</b><span>passed over</span></div>
      </div>
      ${bars ? `<div class="bars">${bars}</div>` : ''}
    </section>${appliedSection(run)}${skippedSection(run)}${stops}`;
}

/* ── NorthList ───────────────────────────────────────── */
export function northlistCard(run: Run): string {
  const pic = `<div class="nl-scene">${scene(run)}</div>`;
  if (run.northlist.connected)
    return `<section class="section nl-card">${pic}<div class="nl-sent"><span class="dot"></span><b>${run.northlist.sent} of ${run.applied.length} sent to NorthList</b></div>
      <p class="nl-after">Replies from these companies land next to each job, and you get an alert on your phone.</p>
      <div class="row"><a class="btn btn-primary" href="${NL_APP}" target="_blank" rel="noopener">Open NorthList ${icon('ext')}</a></div></section>`;
  return `<section class="section nl-card">${pic}<h2>See all of this in NorthList</h2>
      <p>Every job your AI applies to, from every site, with live updates and every reply from the company, sorted from your Gmail. On your phone too.</p>
      <div class="row"><a class="btn btn-primary" href="${NL_SETUP}" target="_blank" rel="noopener">Connect NorthList</a><a class="btn btn-plain" href="${NL_HOME}" target="_blank" rel="noopener">Watch the 60-second film</a></div></section>`;
}

const SCENE_FILL: Run['applied'] = [
  { company: 'Acme Cloud', title: 'Frontend Engineer', site: 'LinkedIn', time: '10:42' },
  { company: 'Brightpath', title: 'React Developer', site: 'Naukri', time: '10:51' },
  { company: 'Cobalt Labs', title: 'UI Engineer', site: 'Workday', time: '11:20' },
  { company: 'Delta Health', title: 'Frontend Engineer', site: 'Indeed', time: '11:34' },
  { company: 'Echo Pay', title: 'Senior Frontend Engineer', site: 'Company site', time: '11:40' },
];

/** NorthList with today's jobs in it: the right side on a laptop, inside the NorthList card on phones. */
export function scene(run: Run): string {
  const rows = [...run.applied, ...SCENE_FILL].slice(0, 5);
  const sites = [...new Set(rows.map((a) => a.site))].map((s) => `<span>${esc(s)}</span>`).join('');
  const appRows = rows
    .map((a, i) => `<div class="app-row">${tile(a.company)}<div><b>${esc(a.company)}</b><span>${esc(a.title)} · via ${esc(a.site)}</span></div><em><strong>${i === 1 ? 'Replied' : 'Applied'}</strong>${esc(a.time)}</em></div>`)
    .join('');
  const phoneRows = rows
    .slice(0, 4)
    .map((a) => `<div class="ph-row">${tile(a.company)}<div><b>${esc(a.company)}</b><span>${esc(a.site)}</span></div></div>`)
    .join('');
  const n = run.applied.length;
  return `<div class="scene">
    <div class="float win"><div class="win-bar"><i></i><i></i><i></i><b>NorthList · Applications</b><small>${n} today</small></div>
      <div class="win-body"><div class="platforms">${sites}</div><div>${appRows}</div></div></div>
    <div class="float ai-live"><div class="live-top"><span class="pulse"></span>${run.northlist.connected ? 'Live in NorthList' : 'What NorthList would show'}</div><p>${n} applied today · ${run.waiting.length} waiting for you</p><div class="bar"><i></i></div></div>
    <div class="float stats"><div><b data-count="${n}">${n}</b><span>Today</span></div><div><b data-count="${run.skipped.length}">${run.skipped.length}</b><span>Skipped</span></div><div><b data-count="1">1</b><span>Replies</span></div></div>
    <div class="phone"><div class="phone-screen"><div class="notif"><b>${icon('bell')} NorthList</b><span>${esc(rows[1].company)} replied: “Can we talk Thursday?”</span></div><h3>Applications</h3>${phoneRows}</div></div>
  </div>`;
}
