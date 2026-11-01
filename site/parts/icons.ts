/**
 * Line icons (24 x 24, 1.5 px stroke) and the NorthList logo, as HTML strings. The build writes them
 * into the pages (see `index.ts`); the example app draws its own with them in the browser.
 */
const PATHS: Record<string, string> = {
  dashboard:
    '<rect x="3.5" y="3.5" width="17" height="17"/><path d="M3.5 9.5h17M9.5 9.5v11"/>',
  mail:
    '<rect x="3" y="5.5" width="18" height="13"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
  doc:
    '<path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 12h6M9 15.5h6"/>',
  renew:
    '<path d="M19.5 12a7.5 7.5 0 0 1-13 5.1M4.5 12a7.5 7.5 0 0 1 13-5.1"/><path d="M17.5 3.5v3.4h-3.4M6.5 20.5v-3.4h3.4"/>',
  model:
    '<circle cx="12" cy="12" r="2.5"/><circle cx="5" cy="6" r="1.6"/><circle cx="19" cy="6" r="1.6"/><circle cx="5" cy="18" r="1.6"/><circle cx="19" cy="18" r="1.6"/><path d="m6.3 7.1 3.8 3.2M17.7 7.1l-3.8 3.2M6.3 16.9l3.8-3.2M17.7 16.9l-3.8-3.2"/>',
  flow:
    '<rect x="3.5" y="4" width="6.5" height="5"/><rect x="14" y="15" width="6.5" height="5"/><path d="M6.75 9v4.5h10.5V15"/>',
  user:
    '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  arrowRight:
    '<path d="M5 12h13.5M13 6.5l5.5 5.5-5.5 5.5"/>',
  arrowDown:
    '<path d="M12 5v13.5M6.5 13l5.5 5.5 5.5-5.5"/>',
  arrowLeft:
    '<path d="M19 12H5.5M11 6.5 5.5 12l5.5 5.5"/>',
  chevronRight:
    '<path d="m9.5 6 6 6-6 6"/>',
  chevronDown:
    '<path d="m6 9.5 6 6 6-6"/>',
  sun:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  moon:
    '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  menu:
    '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close:
    '<path d="M6 6l12 12M18 6 6 18"/>',
  plus:
    '<path d="M12 5v14M5 12h14"/>',
  search:
    '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  filter:
    '<path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/>',
  reply:
    '<path d="M10 7 5 12l5 5"/><path d="M5.5 12H14a5 5 0 0 1 5 5v1"/>',
  send:
    '<path d="M4 12 20 4l-4 16-4-7z"/><path d="m12 13 8-9"/>',
  warning:
    '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 16.8v.4"/>',
  check:
    '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x:
    '<path d="M7 7l10 10M17 7 7 17"/>',
  lock:
    '<rect x="5" y="10.5" width="14" height="10"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  shield:
    '<path d="M12 3.5 19 6v6c0 4.2-3 7.2-7 8.5-4-1.3-7-4.3-7-8.5V6z"/><path d="m9 12 2 2 4-4"/>',
  trash:
    '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  block:
    '<circle cx="12" cy="12" r="8"/><path d="m6.5 6.5 11 11"/>',
  phone:
    '<rect x="7" y="2.5" width="10" height="19"/><path d="M11 18.5h2"/>',
  bell:
    '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5h4"/>',
  offline:
    '<path d="M7 18h10.5a3.5 3.5 0 0 0 .6-6.95A6 6 0 0 0 7.2 9.2 4.5 4.5 0 0 0 7 18z"/><path d="m4 4 16 16"/>',
  pen:
    '<path d="M14.5 5.5l4 4L9 19H5v-4z"/><path d="M12.5 7.5l4 4"/>',
  clock:
    '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  calendar:
    '<rect x="4" y="5.5" width="16" height="15"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  code:
    '<path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4"/>',
  offer:
    '<rect x="3.5" y="4.5" width="17" height="11"/><path d="M7.5 8.5h9M7.5 11.5h5"/><path d="m14 15.5-1 5 2.5-1.5 2.5 1.5-1-5"/>',
  rejection:
    '<circle cx="12" cy="12" r="8"/><path d="m9 9 6 6M15 9l-6 6"/>',
  update:
    '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4.5v3.6h3.6"/>',
  bulb:
    '<path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a5.5 5.5 0 0 0-3.5 9.8c.6.5 1 1.2 1 2v.7h5v-.7c0-.8.4-1.5 1-2A5.5 5.5 0 0 0 12 3.5z"/>',
  list:
    '<path d="M8.5 7H20M8.5 12H20M8.5 17H20"/><path d="M4 7h1.5M4 12h1.5M4 17h1.5"/>',
  install:
    '<path d="M12 4v11M7 10.5l5 5 5-5"/><path d="M4.5 19.5h15"/>',
  eye:
    '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.5"/>',
  eyeOff:
    '<path d="M2.5 12S6 5.5 12 5.5c1.6 0 3 .4 4.2 1M21.5 12S18 18.5 12 18.5c-1.6 0-3-.4-4.2-1"/><path d="m4 20 16-16"/>',
  key:
    '<circle cx="8" cy="15" r="3.5"/><path d="M10.5 12.5 19 4M15.5 7.5l2.5 2.5"/>',
  server:
    '<rect x="4" y="4.5" width="16" height="6"/><rect x="4" y="13.5" width="16" height="6"/><path d="M7.5 7.5h1M7.5 16.5h1"/>',
  globe:
    '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z"/>',
  ext:
    '<path d="M14 4.5h5.5V10M19.5 4.5 11 13M17 14v5.5H4.5V7H10"/>',
  more:
    '<path d="M12 6v.5M12 12v.5M12 18v.5" stroke-width="2.5"/>',
  chart:
    '<path d="M4 20V4M4 20h16"/><path d="M8.5 16v-4M12.5 16V8M16.5 16v-6"/>',
  hourglass:
    '<path d="M7 3.5h10M7 20.5h10M8 3.5c0 4 8 5 8 8.5s-8 4.5-8 8.5M16 3.5c0 4-8 5-8 8.5s8 4.5 8 8.5"/>',
  tag:
    '<path d="M3.5 12.5V4h8.5l8.5 8.5-8.5 8.5z"/><circle cx="8" cy="8.5" r="1"/>',
  contrast:
    '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/>',
  inbox:
    '<path d="M3.5 13.5 6 5h12l2.5 8.5V19h-17z"/><path d="M3.5 13.5H9a3 3 0 0 0 6 0h5.5"/>',
  mailOff:
    '<rect x="3" y="5.5" width="18" height="13"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/><path d="m3 21 18-18"/>',
};

export function icon(name: string, size = 16, cls = ''): string {
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true">${PATHS[name] ?? ''}</svg>`;
}

/** The logo's mark: a sun on the horizon. The small one has fewer lines. */
const LARGE =
  'M2 16A14 14 0 0 1 30 16ZM2.081 17.5H24.5A1.5 1.5 0 0 1 24.5 20.5H2.743A14 14 0 0 1 2.081 17.5ZM3.351 22H19.5A1.5 1.5 0 0 1 19.5 25H5.276A14 14 0 0 1 3.351 22ZM6.74 26.5H15A1.5 1.5 0 0 1 15 29.5H12.292A14 14 0 0 1 6.74 26.5Z';
const SMALL =
  'M2 16A14 14 0 0 1 30 16ZM2.144 18H22A2 2 0 0 1 22 22H3.351A14 14 0 0 1 2.144 18ZM4.511 24H15.5A2 2 0 0 1 15.5 28H8.789A14 14 0 0 1 4.511 24Z';

export function wordmark(size = 22): string {
  return `<span class="wm" style="font-size:${size}px" role="img" aria-label="NorthList"><span aria-hidden="true">n</span><svg viewBox="2 2 28 28" aria-hidden="true"><path d="${size < 28 ? SMALL : LARGE}"/></svg><span aria-hidden="true">rthlist</span></span>`;
}

export function mark(size = 22): string {
  return `<svg width="${size}" height="${size}" viewBox="2 2 28 28" aria-hidden="true" style="fill:var(--mark)"><path d="${size < 24 ? SMALL : LARGE}"/></svg>`;
}