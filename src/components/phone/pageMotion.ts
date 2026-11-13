/**
 * The phone's page slide, drawn straight on the page elements (owner, 13 Nov 2026, approved mock
 * `IOS-LOOK-mock/`): the top page slides in from the right while the page under it moves a third
 * of the way left and darkens. React shows one live page at a time; the page under it is a still
 * copy taken as it left, so a swipe back can show it under the finger.
 */
import { prefersReducedMotion } from '../../lib/spring';

/** A page's look at one moment: a copy that cannot be used, and how far it was scrolled. */
export interface PageSnapshot {
  element: HTMLElement;
  scrollTop: number;
}

/** The scrolling part of a page; the page frame marks it. */
export const scrollerOf = (page: ParentNode) =>
  page.querySelector<HTMLElement>('[data-phone-scroller]');

/** Copies the page as it is now. Ids are dropped (they belong to the live page) and fields keep their text. */
export function takeSnapshot(page: HTMLElement): PageSnapshot {
  const element = page.cloneNode(true) as HTMLElement;
  for (const el of [element, ...element.querySelectorAll('[id]')]) el.removeAttribute('id');
  const live = page.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
  const copies = element.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input, textarea',
  );
  live.forEach((field, i) => copies[i]?.setAttribute('value', field.value));
  element.style.transform = '';
  element.style.opacity = '';
  return { element, scrollTop: scrollerOf(page)?.scrollTop ?? 0 };
}

/** The dark film that falls over a page as another slides over it. */
export const SHADE_CLASS =
  'pointer-events-none absolute inset-0 z-30 bg-[var(--page-shade)] opacity-0';

function makeShade() {
  const shade = document.createElement('div');
  shade.dataset.phoneShade = '';
  shade.className = SHADE_CLASS;
  return shade;
}

/** Puts a copy into a layer, with its own shade, and scrolls it to where the page was. */
export function showSnapshot(layer: HTMLElement, snapshot: PageSnapshot | undefined) {
  layer.replaceChildren(...(snapshot ? [snapshot.element] : []), makeShade());
  layer.hidden = false;
  const scroller = snapshot && scrollerOf(snapshot.element);
  if (scroller) scroller.scrollTop = snapshot.scrollTop;
}

export function hideLayer(layer: HTMLElement) {
  layer.hidden = true;
  layer.replaceChildren();
  layer.style.transform = '';
  setShade(layer, 0);
}

function setShade(page: HTMLElement, amount: number) {
  const shade = page.querySelector<HTMLElement>(':scope > [data-phone-shade]');
  if (shade) shade.style.opacity = String(amount);
}

/**
 * One frame of the slide. `p` is how far the top page is in: 1 fully in, 0 gone to the right.
 * With less motion asked for, the top page fades instead and nothing moves.
 */
export function slideFrame(below: HTMLElement, top: HTMLElement, p: number) {
  if (prefersReducedMotion()) {
    top.style.opacity = String(p);
    return;
  }
  const width = top.clientWidth || window.innerWidth;
  top.style.transform = `translate3d(${(1 - p) * width}px,0,0)`;
  below.style.transform = `translate3d(${-0.3 * width * p}px,0,0)`;
  setShade(below, p);
}

/** Back to rest: no slide left on either page. */
export function clearFrame(...pages: HTMLElement[]) {
  for (const page of pages) {
    page.style.transform = '';
    page.style.opacity = '';
    setShade(page, 0);
  }
}
