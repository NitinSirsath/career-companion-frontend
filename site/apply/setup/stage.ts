/*
 * Two small helpers the run page (site/apply/run) still uses for its NorthList scene. The setup page no
 * longer has a picture on the side (owner, 24 Nov 2026): its NorthList step draws its own, in northlist.ts.
 */
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s);

/** The scene keeps its size and scales down to fit the right side. */
export function fitScene() {
  const sc = $('#picture .scene');
  const st = $('.stage');
  if (!sc || !st?.clientWidth) return;
  sc.style.scale = String(Math.min(1, (st.clientWidth - 64) / 740, (st.clientHeight - 64) / 540));
}

/** The faint rings behind the pictures. */
export const rings = () =>
  Array.from({ length: 13 }, (_, i) => `<circle cx="50%" cy="50%" r="${60 + i * 70}" fill="none" stroke="var(--art)" stroke-opacity=".06"/>`).join('');
