import { releases } from './changelog.ts';
import { footer, header } from './chrome.ts';
import { DATA_LEAD, flow, promises } from './data.ts';
import { icon, mark } from './icons.ts';

/**
 * Fills a page's placeholders with the shared parts, when the site is built (and in the dev server),
 * so every page's words are in its HTML before any script runs:
 * `<div data-site-header></div>`, `<div data-site-footer></div>`, `<p data-lead></p>`,
 * `<div … data-promises></div>`, `<div … data-flow></div>`, `<div … data-changelog></div>`,
 * `<i data-icon="name" data-size="16"></i>` and `<i data-mark="16"></i>`.
 */
export function fillParts(html: string): string {
  const page = /<body data-page="([a-z]+)"/.exec(html)?.[1] ?? '';
  const inside = (hook: string, content: string) =>
    html.replace(new RegExp(`(<div[^>]* ${hook}[^>]*>)(</div>)`, 'g'), (_, open: string, close: string) => open + content + close);
  html = html
    .replace('<div data-site-header></div>', () => header(page))
    .replace('<div data-site-footer></div>', () => footer())
    .replace(/<p data-lead><\/p>/g, () => `<p>${DATA_LEAD}</p>`);
  html = inside('data-promises', promises());
  html = inside('data-flow', flow());
  html = inside('data-changelog', releases());
  return html
    .replace(/<i data-icon="([A-Za-z]+)"(?: data-size="(\d+)")?><\/i>/g, (_, name: string, size?: string) =>
      icon(name, Number(size) || 16),
    )
    .replace(/<i data-mark="(\d+)"><\/i>/g, (_, size: string) => mark(Number(size)));
}
