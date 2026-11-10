import { icon, wordmark } from './icons.ts';

/** Sign-in lives on the app site. Every "Sign in" and "Start free" goes there. */
export const SIGN_IN = 'https://app.northlist.site/login';
export const CONTACT = 'nitinsirsath8855@gmail.com';
/** The legal policy keeps its Google-approved address. */
export const POLICY = '/privacy.html';

/** The main links: label, address, and the page they mark as current. */
const NAV: [string, string, string][] = [
  ['Features', '/#features', 'features'],
  ['NorthList Apply', '/automation', 'automation'],
  ['Privacy', '/privacy/', 'privacy'], // with the slash: Render serves privacy.html (the policy) at /privacy
  ['Pricing', '/pricing', 'pricing'],
  ['Changelog', '/changelog', 'changelog'],
  ['About', '/about', 'about'],
];

/** Light / Dark switch, in the footer and the phone menu. */
function themeSwitch(): string {
  return `<div class="seg" role="group" aria-label="Theme"><button type="button" data-theme-set="light">${icon('sun', 14)} Light</button><button type="button" data-theme-set="dark">${icon('moon', 14)} Dark</button></div>`;
}

/** The header, and the full-screen menu that phones open from it. */
export function header(page: string): string {
  const links = NAV.map(
    ([label, href, key]) => `<a href="${href}"${key === page ? ' aria-current="page"' : ''}>${label}</a>`,
  ).join('');
  const rows = NAV.map(([label, href]) => `<a class="row" href="${href}">${label}${icon('chevronRight', 18)}</a>`).join('');
  return `<header class="hdr"><div class="hdr-in">
    <a class="brand" href="/" aria-label="NorthList home">${wordmark(21)}</a>
    <nav class="nav" aria-label="Main">${links}</nav>
    <div class="hdr-right">
      <a class="btn btn-ghost btn-sm signin" href="${SIGN_IN}">Sign in</a>
      <a class="btn btn-primary btn-sm" href="${SIGN_IN}">Start free</a>
      <button type="button" class="icon-btn menu-btn" aria-expanded="false" aria-controls="site-sheet" aria-label="Open menu">${icon('menu', 20)}</button>
    </div>
  </div></header>
  <div class="sheet" id="site-sheet">
    ${rows}
    <div class="sheet-actions"><a class="btn btn-primary" href="${SIGN_IN}">Start free</a><a class="btn btn-secondary" href="${SIGN_IN}">Sign in</a></div>
    <div class="sheet-theme">${themeSwitch()}</div>
  </div>`;
}

export function footer(): string {
  return `<footer class="ftr"><div class="ftr-in">
    <div class="brandcol">${wordmark(20)}<p class="tagline">Your job search, sorted from your Gmail.</p></div>
    <div><h4>Product</h4><ul><li><a href="/#features">Features</a></li><li><a href="/automation">NorthList Apply</a></li><li><a href="/pricing">Pricing</a></li><li><a href="/changelog">Changelog</a></li></ul></div>
    <div><h4>Trust</h4><ul><li><a href="/privacy/">Privacy</a></li><li><a href="${POLICY}">Privacy policy</a></li></ul></div>
    <div><h4>Company</h4><ul><li><a href="/about">About</a></li><li><a href="mailto:${CONTACT}">Contact</a></li></ul></div>
    <div class="base"><span>© 2026 NorthList</span>${themeSwitch()}</div>
  </div></footer>`;
}
