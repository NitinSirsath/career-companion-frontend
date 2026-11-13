import { Switch as BaseSwitch } from '@base-ui/react/switch';

/** An on/off switch, as phone settings have: green when on, the knob springs across. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <BaseSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className="relative inline-flex h-[31px] w-[51px] shrink-0 cursor-pointer items-center rounded-full bg-border-default p-0.5 transition-colors duration-250 outline-none focus-visible:outline-2 focus-visible:outline-border-focus data-checked:bg-ok data-disabled:cursor-default data-disabled:opacity-50"
    >
      <BaseSwitch.Thumb className="size-[27px] rounded-full bg-white shadow-[0_2px_4px_rgb(0_0_0/0.2)] transition-transform duration-350 ease-[cubic-bezier(0.25,1.4,0.4,1)] data-checked:translate-x-5" />
    </BaseSwitch.Root>
  );
}
