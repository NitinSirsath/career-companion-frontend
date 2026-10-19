import { useState } from 'react';
import { Combobox } from './ui/combobox';

export interface PickableApplication {
  id: string;
  companyName: string;
  jobTitle?: string | null;
}

interface Choice {
  id: string;
  title: string;
  detail: string | null;
}

interface ApplicationPickerProps {
  label: string;
  applications: readonly PickableApplication[];
  /** The chosen id, or "" for none. */
  value: string;
  onChange: (id: string) => void;
  /** Choices that are not applications, listed first: "Not linked to any application". */
  extraChoices?: readonly { id: string; label: string }[];
  disabled?: boolean;
  loading?: boolean;
  id?: string;
  helperText?: string;
  hideLabel?: boolean;
}

const toChoice = (app: PickableApplication): Choice => ({
  id: app.id,
  title: app.companyName,
  detail: app.jobTitle || null,
});

/** Pick one of your applications: type part of the company or job title to narrow the list. */
export function ApplicationPicker({
  label,
  applications,
  value,
  onChange,
  extraChoices = [],
  disabled,
  loading,
  id,
  helperText,
  hideLabel,
}: ApplicationPickerProps) {
  const choices: Choice[] = [
    ...extraChoices.map((extra) => ({ id: extra.id, title: extra.label, detail: null })),
    ...applications.map(toChoice),
  ];
  const [chosen, setChosen] = useState<Choice | null>(null);
  const selected = choices.find((choice) => choice.id === value) ?? (value ? chosen : null);
  return (
    <Combobox<Choice>
      id={id}
      label={label}
      hideLabel={hideLabel}
      items={choices}
      value={selected}
      onValueChange={(choice) => {
        setChosen(choice);
        onChange(choice?.id ?? '');
      }}
      itemToString={(choice) =>
        choice.detail ? `${choice.title} · ${choice.detail}` : choice.title
      }
      itemKey={(choice) => choice.id}
      renderItem={(choice) => (
        <span className="flex flex-col">
          <span>{choice.title}</span>
          {choice.detail && <span className="text-xs text-text-secondary">{choice.detail}</span>}
        </span>
      )}
      placeholder="Search applications"
      emptyText="No application matches"
      disabled={disabled}
      loading={loading}
      helperText={helperText}
    />
  );
}
