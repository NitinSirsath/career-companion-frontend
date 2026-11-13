/**
 * iPhones open the keyboard only for a field focused during the tap itself. A sheet's field is made
 * a moment later, so the tap focuses this stand-in field first; the sheet's own field then takes
 * the focus, and the keyboard stays up. The stand-in removes itself soon after.
 */
export function holdKeyboard() {
  if (typeof document === 'undefined') return;
  const field = document.createElement('input');
  field.setAttribute('aria-hidden', 'true');
  field.tabIndex = -1;
  // 16px: a smaller field would make the phone zoom in.
  field.style.cssText =
    'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;pointer-events:none';
  document.body.append(field);
  field.focus({ preventScroll: true });
  window.setTimeout(() => field.remove(), 1500);
}
