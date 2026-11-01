/**
 * The changelog (owner, 31 Oct 2026): what changed for users, newest first, written from merged PRs.
 * Add each release that users can see at the top. Each entry's anchor is its date, such as `#oct-31`.
 */
interface Release {
  date: string;
  title: string;
  text: string;
  also?: string[];
  /** The Dashboard release shows its numbers strip. */
  numbers?: boolean;
}

export const RELEASES: Release[] = [
  {
    date: '2026-10-31',
    title: 'NorthList on your phone, with alerts',
    text: 'Install NorthList from your browser on your phone or computer, like an app. Turn on alerts on each device, and a new step reaches you when the AI finds one. Pages you opened also work without a connection, read-only.',
    also: [
      'northlist.site is now the product site. The app moved to app.northlist.site.',
      'The beta is open to the first 99 accounts. After that, the sign-in page says so.',
      'A "page not found" page for the product site.',
    ],
  },
  {
    date: '2026-10-29',
    title: 'The Dashboard',
    numbers: true,
    text: 'Your job search in numbers: applications sent, replies, interviews, offers and rejections, next to the 30 days before. Where your jobs stand right now, and where rejections happen. At most once a day, a short tip, written without reading your mails. The Dashboard is now the first page you see.',
    also: [
      'Delete a conversation or an application, and block a company.',
      'Replies with bold, lists and links. The quoted mail folds the way Gmail does it.',
      'For mail that is not about a job, NorthList keeps almost nothing, and deletes even that after 35 days.',
      'Gmail sync lists job mails only, with their type.',
    ],
  },
  {
    date: '2026-10-26',
    title: 'Steps close by themselves',
    text: 'The AI now reads your replies and newer mails, and closes the steps they settle. Each closed step says why, such as "Your reply answered it". If you did it some other way, press "I did this". A step whose date has passed says Past due.',
    also: ['Reply with AI: choices for each mail, or Write with AI with your own hint.'],
  },
  {
    date: '2026-10-25',
    title: 'Free AI, and a new name',
    text: "Career Companion is now NorthList, with a new logo. NorthList now includes free AI, so you don't need an AI key to start. You can still use your own key, and keep the free AI as a backup. Gmail is checked about once an hour, and the side menu shows how many mails the AI still has to read.",
  },
  {
    date: '2026-10-23',
    title: 'Fake offer warning',
    text: 'If a mail asks you to pay to get a job, NorthList marks it as Probably fake and tells you not to pay. The mail stays in your list, and you decide.',
    also: ['Connect several AI providers and choose which one is active.'],
  },
  {
    date: '2026-10-22',
    title: 'A new look',
    text: 'A calmer, flatter design in Light and Dark, with the Geist font. On a phone, NorthList now feels like a phone app, with tabs at the bottom. While the server wakes up, a start-up screen says so, instead of signing you out.',
  },
  {
    date: '2026-10-13',
    title: 'Reply from NorthList',
    text: 'Reply to a job mail, or reply to all, right from the mail page. It is sent from your own Gmail, and only when you press Send.',
  },
  {
    date: '2026-10-12',
    title: 'Mails first',
    text: 'A new Mails page lists every job mail with what it asks of you and the application it belongs to. Open one to see the whole conversation, read live from Gmail.',
  },
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** `2026-10-31` → `oct-31` (the anchor) and `October 31, 2026` (shown). */
export function anchor(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${MONTHS[m - 1].slice(0, 3).toLowerCase()}-${d}`;
}
function shown(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** The Dashboard's five numbers, drawn as in the app. */
const NUMBERS = `<div class="stats-strip"><div class="sa-stats">
  <div class="sa-stat"><span class="k">Applications sent</span><span class="v">12</span><span class="d">↑ 3 vs the 30 days before</span></div>
  <div class="sa-stat"><span class="k">Replies received</span><span class="v">7</span><span class="d">↑ 2 vs the 30 days before</span></div>
  <div class="sa-stat"><span class="k">Interviews reached</span><span class="v">2</span><span class="d">↑ 1 vs the 30 days before</span></div>
  <div class="sa-stat"><span class="k">Offers</span><span class="v">0</span><span class="d">Same as the 30 days before</span></div>
  <div class="sa-stat"><span class="k">Rejections</span><span class="v">3</span><span class="d">↓ 1 vs the 30 days before</span></div>
</div></div>`;

export function releases(): string {
  return RELEASES.map((r) => {
    const also = r.also
      ? `<ul class="also"><li class="al">Also in this release</li>${r.also.map((a) => `<li>${a}</li>`).join('')}</ul>`
      : '';
    return `<article class="entry" id="${anchor(r.date)}">
      <time class="date" datetime="${r.date}">${shown(r.date)}</time>
      <div class="ec"><h2>${r.title}</h2>${r.numbers ? NUMBERS : ''}<p>${r.text}</p>${also}</div>
    </article>`;
  }).join('\n');
}
