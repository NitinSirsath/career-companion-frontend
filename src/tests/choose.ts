import { expect } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

/** Presses an option the way a mouse does: Base UI selects on the pointer release, not the click. */
export function pressOption(option: HTMLElement) {
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.mouseDown(option);
  fireEvent.pointerUp(option, { pointerType: 'mouse' });
  fireEvent.mouseUp(option);
  fireEvent.click(option);
}

/** Opens a Select and picks the option with this name, then waits for the list to close. */
export async function chooseOption(trigger: HTMLElement, optionName: string | RegExp) {
  fireEvent.click(trigger);
  pressOption(await screen.findByRole('option', { name: optionName }));
  await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
}

/** Opens a Combobox by its arrow button and picks the option with this name. */
export async function chooseFromCombobox(label: string, optionName: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name: `Open ${label}` }));
  pressOption(await screen.findByRole('option', { name: optionName }));
}
