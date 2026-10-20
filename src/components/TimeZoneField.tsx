import { Fragment, useMemo } from 'react';
import { cachedZoneOffset, timeZones } from '../lib/timeZones';
import { browserTimeZone } from '../lib/workspace';
import { Combobox } from './ui/combobox';

/** A long zone name may wrap after "/" or "_" on a phone, never inside a word. */
function ZoneName({ name }: { name: string }) {
  return name.split(/(?<=[/_])/).map((part, index) => (
    <Fragment key={index}>
      {index > 0 && <wbr />}
      {part}
    </Fragment>
  ));
}

/** Pick a time zone by typing part of its name. It starts with the computer's own zone. */
export function TimeZoneField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (zone: string) => void;
  className?: string;
}) {
  const own = browserTimeZone();
  const zones = useMemo(() => timeZones(own), [own]);
  return (
    <Combobox<string>
      label="Time zone"
      items={zones}
      value={value || null}
      onValueChange={(zone) => onChange(zone ?? '')}
      itemToString={(zone) => zone}
      itemKey={(zone) => zone}
      renderItem={(zone) => (
        <span className="flex items-baseline gap-2">
          <span className="min-w-0">
            <ZoneName name={zone} />
            {zone === own && ' (your computer)'}
          </span>
          <span className="shrink-0 text-xs whitespace-nowrap text-text-secondary">
            {cachedZoneOffset(zone)}
          </span>
        </span>
      )}
      emptyText="No time zone matches"
      helperText="Starts with your computer's time zone."
      className={className}
    />
  );
}
