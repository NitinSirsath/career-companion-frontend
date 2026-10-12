/** True when the sender's HTML points at pictures on the internet. */
export const hasRemoteImages = (html: string): boolean =>
  /<img\b[^>]*\bsrc\s*=\s*["']?\s*https?:/i.test(html);

/**
 * The document shown inside the mail frame. The frame's sandbox already stops scripts and forms;
 * this policy also stops every network request, so opening a mail tells the sender nothing.
 * Pictures load only after the user asks for them. Links open in a new tab.
 *
 * The colours are fixed on purpose: a sender writes a mail for a white page, in every theme.
 */
export function mailFrameDocument(html: string, showImages: boolean): string {
  const images = showImages ? 'img-src https: data:' : 'img-src data:';
  const policy = `default-src 'none'; style-src 'unsafe-inline'; ${images}`;
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${policy}">`,
    '<meta name="referrer" content="no-referrer"><base target="_blank">',
    '<style>body{margin:0;padding:4px;font:14px/1.6 system-ui,sans-serif;color:#161616;',
    'background:#ffffff;overflow-wrap:anywhere}img{max-width:100%;height:auto}</style>',
    `</head><body>${html}</body></html>`,
  ].join('');
}
