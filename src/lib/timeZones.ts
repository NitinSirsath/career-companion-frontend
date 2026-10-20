import { browserTimeZone } from './workspace';

/** "UTC+05:30": a zone's offset from UTC right now. */
export function zoneOffset(zone: string, at = new Date()): string {
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
      .formatToParts(at)
      .find((part) => part.type === 'timeZoneName')?.value;
    if (!name || name === 'GMT') return 'UTC+00:00';
    return name.replace('GMT', 'UTC');
  } catch {
    return '';
  }
}

// Offsets are worked out once per zone, when the list first shows it.
const offsets = new Map<string, string>();

export function cachedZoneOffset(zone: string): string {
  if (!offsets.has(zone)) offsets.set(zone, zoneOffset(zone));
  return offsets.get(zone) ?? '';
}

// The project's TypeScript library predates this call; every browser the app supports has it.
const supportedZones = (Intl as { supportedValuesOf?: (key: 'timeZone') => string[] })
  .supportedValuesOf;

/** Every time zone the browser knows, the computer's own first, then UTC. */
export function timeZones(own = browserTimeZone()): string[] {
  const known = supportedZones ? supportedZones.call(Intl, 'timeZone') : [];
  return [...new Set([own, 'UTC', ...known])];
}
