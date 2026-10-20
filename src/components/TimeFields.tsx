import type { ReactNode } from 'react';
import { Input } from './ui/input';
import { TimeZoneField } from './TimeZoneField';

const LABEL_CLASS = 'mb-2 text-xs leading-4 tracking-[0.32px] text-text-secondary';

/** A labelled box: the label sits above it, as in every form of the app. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col">
      <span className={LABEL_CLASS}>{label}</span>
      {children}
    </label>
  );
}

export function TimeFields({
  date,
  time,
  zone,
  setDate,
  setTime,
  setZone,
  timeLabel,
}: {
  date: string;
  time: string;
  zone: string;
  setDate: (v: string) => void;
  setTime: (v: string) => void;
  setZone: (v: string) => void;
  timeLabel: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
      <Field label="Date">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label={timeLabel}>
        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </Field>
      <TimeZoneField value={zone} onChange={setZone} className="sm:col-span-2" />
    </div>
  );
}
