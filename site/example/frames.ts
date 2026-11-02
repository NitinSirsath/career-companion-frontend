/*
 * Phone pictures (owner, 1 Nov 2026): the phone layout inside an iPhone 18 or a Pixel 11 Pro, drawn
 * flat at their real screen sizes (402 x 874 and 427 x 952 CSS px; the iPhone 18's is the iPhone 18
 * Pro's 6.3-inch screen), then zoomed to fit. Android visitors see the Pixel, everyone else the iPhone;
 * `?device=pixel` or `?device=iphone` picks one.
 * The hero's frame (`.phone-only`) shows on phones only: from 600 px up it falls away (the styles make
 * it `display: contents`) and the laptop picture shows instead.
 */
export type Device = 'iphone' | 'pixel';

export const deviceFor = (userAgent: string, search = ''): Device => {
  const asked = new URLSearchParams(search).get('device');
  if (asked === 'iphone' || asked === 'pixel') return asked;
  return /Android/i.test(userAgent) ? 'pixel' : 'iphone';
};

/** Signal, Wi-Fi and battery, drawn the way each phone draws them. */
const STATUS_ICONS: Record<Device, string> = {
  iphone:
    '<svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect y="7.5" width="3" height="4.5" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2.5" width="3" height="9.5" rx="1"/><rect x="15" width="3" height="12" rx="1"/></svg>' +
    '<svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1.6 4.6a9 9 0 0 1 12.8 0"/><path d="M4.4 7.4a5 5 0 0 1 7.2 0"/><circle cx="8" cy="10.2" r="1.3" fill="currentColor" stroke="none"/></svg>' +
    '<svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity="0.4"/><rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor"/><path d="M25 4.5v4a2 2 0 0 0 0-4z" fill="currentColor" opacity="0.4"/></svg>',
  pixel:
    '<svg width="15" height="12" viewBox="0 0 15 12" fill="currentColor"><path d="M7.5 12 0 2.9A12 12 0 0 1 15 2.9z"/></svg>' +
    '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M12 0v12H0z"/></svg>' +
    '<svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor"><rect x="2.5" width="3" height="2" rx="0.5"/><rect y="1.5" width="8" height="12.5" rx="1.5"/></svg>',
};

/** Side buttons: side, top and height in px at real size. */
const SIDE_BUTTONS: Record<Device, ['l' | 'r', number, number][]> = {
  iphone: [
    ['l', 118, 30],
    ['l', 176, 58],
    ['l', 246, 58],
    ['r', 206, 92],
    ['r', 468, 62],
  ],
  pixel: [
    ['r', 190, 62],
    ['r', 292, 118],
  ],
};

/** Zooms a phone to the width it has (at most `--dv-max`, never above real size). */
function fitDevice(dev: HTMLElement): void {
  const holder = dev.parentElement;
  if (!holder) return;
  let lastW = -1;
  const apply = (force: boolean) => {
    if (getComputedStyle(dev).display === 'contents') {
      dev.style.removeProperty('zoom');
      lastW = -1;
      return;
    }
    const room = holder.clientWidth;
    if (!room || (room === lastW && !force)) return;
    lastW = room;
    const cs = getComputedStyle(dev);
    const px = (name: string) => parseFloat(cs.getPropertyValue(name)) || 0;
    const natural = px('--dv-w') + 2 * (px('--dv-bezel') + px('--dv-edge'));
    const max = px('--dv-max') || natural;
    dev.style.setProperty('zoom', String(Math.min(1, Math.min(room, max) / natural)));
  };
  // Zoom on the next frame, so the holder's new height does not loop back into the observer.
  new ResizeObserver(() => requestAnimationFrame(() => apply(false))).observe(holder);
  matchMedia('(max-width: 599px)').addEventListener('change', () => apply(true));
  apply(true);
}

/** Wraps each `[data-frame]` element's content in a phone: status bar, camera, screen, home bar. */
export function buildFrames(device: Device = deviceFor(navigator.userAgent, location.search)): void {
  document.documentElement.dataset.device = device;
  document.querySelectorAll<HTMLElement>('[data-frame]').forEach((dev) => {
    const kids = [...dev.childNodes];
    const buttons = SIDE_BUTTONS[device]
      .map(([side, top, h]) => `<span class="dv-btn ${side}" style="top:${top}px;height:${h}px"></span>`)
      .join('');
    dev.classList.add('device');
    dev.innerHTML = `${buttons}
      <div class="dv-body"><div class="dv-screen">
        <div class="dv-status" aria-hidden="true"><span class="dv-time">9:41</span><span></span><span class="dv-icons">${STATUS_ICONS[device]}</span></div>
        <span class="dv-cut" aria-hidden="true"></span>
        <div class="dv-app"></div>
        <div class="dv-home" aria-hidden="true"><span></span></div>
      </div></div>`;
    dev.querySelector('.dv-app')?.append(...kids);
    fitDevice(dev);
  });
}
