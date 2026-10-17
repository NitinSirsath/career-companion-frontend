/** True when the sender's HTML points at pictures on the internet. */
export const hasRemoteImages = (html: string): boolean =>
  /<img\b[^>]*\bsrc\s*=\s*["']?\s*https?:/i.test(html);

/** A text or background colour in the sender's styles or attributes (`color:`, `bgcolor=`, …). */
const OWN_COLORS = /(?:^|[\s;"'{])(?:color|background(?:-color)?)\s*:|\b(?:bg)?color\s*=/i;

/**
 * True when the sender's HTML sets colours of its own. Such a mail was written for a white page,
 * so it keeps one in every theme; changing its colours could make its text unreadable.
 */
export const setsOwnColors = (html: string): boolean => OWN_COLORS.test(html);

/** The app theme's text and page colours, for a mail that sets none of its own. */
export interface MailColors {
  text: string;
  background: string;
}

const WHITE_PAGE = 'color:#161616;background:#ffffff';

/**
 * The document shown inside the mail frame. The frame's sandbox already stops scripts and forms;
 * this policy also stops every network request, so opening a mail tells the sender nothing.
 * Pictures load only after the user asks for them. Links open in a new tab.
 *
 * With `colors`, a mail that sets none of its own takes the theme's; otherwise it is shown on the
 * white page a sender writes for.
 */
export function mailFrameDocument(html: string, showImages: boolean, colors?: MailColors): string {
  const images = showImages ? 'img-src https: data:' : 'img-src data:';
  const policy = `default-src 'none'; style-src 'unsafe-inline'; ${images}`;
  const page = colors ? `color:${colors.text};background:${colors.background}` : WHITE_PAGE;
  // Theme colours: links keep the text colour, underlined, so they stay readable.
  const links = colors ? 'a{color:inherit}' : '';
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${policy}">`,
    '<meta name="referrer" content="no-referrer"><base target="_blank">',
    `<style>body{margin:0;padding:4px;font:14px/1.6 system-ui,sans-serif;${page};`,
    `overflow-wrap:anywhere}img{max-width:100%;height:auto}${links}</style>`,
    `</head><body>${html}</body></html>`,
  ].join('');
}
