import { anchor, RELEASES } from './changelog.ts';

/**
 * The changelog page (owner, 19 Nov 2026): the same releases and dates as
 * `changelog.ts`, in a date column and an entry column. Some releases get one small coded picture of
 * the piece they changed: one piece, centred, one accent. Made-up example data, as on Home.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2026-10-31` → `Oct 31, 2026`. */
function shown(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

const row = (subject: string, step: string, extra = '', unread = false) =>
  `<div class="pr-mrow${unread ? ' new' : ''}"><span class="u"></span><div><b>${subject}</b><span class="s"><i data-app-icon="arrowRight" data-size="14"></i><span>${step}</span></span>${extra}</div></div>`;

/** One picture per release that changed something you can see; the rest stay text. */
const PICTURES: Record<string, string> = {
  // One list, newest first, with the line that says how many mails need you
  '2026-11-04': `<div class="pr-piece pr-mails">
    <p class="pr-mails-top"><b>Mails</b><span>3 mails need you. Everything else is up to date.</span></p>
    ${row('Interview invitation: Frontend Engineer', 'Choose an interview time · Due Mon, Nov 3', '', true)}
    ${row('Your take-home test', 'Finish the coding test · Due Thu, Nov 6')}
    ${row('Free for a 15-minute call this week?', 'Suggest a time for a call · Due Fri, Nov 7')}
  </div>`,
  // An alert: the company and the step, never the mail's text
  '2026-10-31': `<div class="pr-piece pr-alert">
    <span class="pr-alert-icon"><i data-mark="20"></i></span>
    <div><p class="pr-alert-head"><b>NorthList</b><span>now</span></p><p class="pr-alert-title">Brightwave</p><p class="pr-alert-body">Choose an interview time</p></div>
  </div>`,
  // Three of the Dashboard's numbers
  '2026-10-29': `<div class="pr-piece pr-nums">
    <div><span class="k">Applications sent</span><span class="v">12</span><span class="d up">↑ 3 vs the 30 days before</span></div>
    <div><span class="k">Replies received</span><span class="v">7</span><span class="d">↑ 2 vs the 30 days before</span></div>
    <div><span class="k">Interviews reached</span><span class="v">2</span><span class="d">↑ 1 vs the 30 days before</span></div>
  </div>`,
  // A step that closed by itself, and why
  '2026-10-26': `<div class="pr-piece pr-stepdone">
    <span class="lbl">Next step</span>
    <b>Choose an interview time</b>
    <p class="ok"><i data-app-icon="checkCircle" data-size="16"></i>Done · Your reply answered it</p>
  </div>`,
  // The warning on a mail that asks you to pay
  '2026-10-23': `<div class="pr-piece pr-mails pr-fake">
    ${row('Congratulations! Your offer letter is ready', 'Don’t pay. Check this job on the company’s own careers site.', '<span class="pr-warn"><i data-app-icon="warning" data-size="14"></i>Probably fake</span>')}
  </div>`,
};

export function releases(): string {
  return RELEASES.map((r) => {
    const pic = PICTURES[r.date]
      ? `<figure class="pr-ent-pic" aria-hidden="true">${PICTURES[r.date]}</figure>`
      : '';
    const also = r.also
      ? `<div class="pr-also"><p>Also in this release</p><ul>${r.also.map((a) => `<li>${a}</li>`).join('')}</ul></div>`
      : '';
    return `<article class="pr-ent rv" id="${anchor(r.date)}" aria-labelledby="t-${anchor(r.date)}">
      <div class="pr-ent-date"><a href="#${anchor(r.date)}"><time datetime="${r.date}">${shown(r.date)}</time></a></div>
      <div class="pr-ent-body"><h2 id="t-${anchor(r.date)}">${r.title}</h2>${pic}<p class="pr-ent-text">${r.text}</p>${also}</div>
    </article>`;
  }).join('\n');
}
