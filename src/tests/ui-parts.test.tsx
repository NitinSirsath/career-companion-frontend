/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Select } from '../components/ui/select';
import { Combobox } from '../components/ui/combobox';
import { chooseFromCombobox, chooseOption } from './choose';

const OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Needs action' },
] as const;

describe('Select', () => {
  afterEach(cleanup);

  it('opens its own list and reports the picked value', async () => {
    const onValueChange = vi.fn();
    render(<Select label="Action" options={OPTIONS} value="all" onValueChange={onValueChange} />);
    const trigger = screen.getByRole('combobox', { name: 'Action' });
    expect(trigger).toHaveTextContent('All');
    await chooseOption(trigger, 'Needs action');
    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith('open'));
  });
});

describe('Combobox', () => {
  afterEach(cleanup);
  const APPS = [
    { id: 'a1', name: 'Quanta Labs' },
    { id: 'a2', name: 'BrightPath Analytics' },
  ];

  it('filters its own items as the user types and says when nothing matches', async () => {
    render(
      <Combobox
        label="Application"
        items={APPS}
        value={null}
        onValueChange={() => {}}
        itemToString={(a) => a.name}
        itemKey={(a) => a.id}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open Application' }));
    const input = await screen.findByRole('combobox', { name: 'Application', hidden: true });
    fireEvent.change(input, { target: { value: 'quanta' } });
    expect(await screen.findByRole('option', { name: 'Quanta Labs' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'BrightPath Analytics' })).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(await screen.findByText('Nothing matches')).toBeInTheDocument();
  });

  it('asks the server to search and shows "Searching…" while it loads', async () => {
    const onSearch = vi.fn();
    render(
      <Combobox
        label="Application"
        items={[]}
        value={null}
        onValueChange={() => {}}
        itemToString={(a: { id: string; name: string }) => a.name}
        itemKey={(a) => a.id}
        onSearch={onSearch}
        loading
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open Application' }));
    const input = await screen.findByRole('combobox', { name: 'Application', hidden: true });
    fireEvent.change(input, { target: { value: 'bri' } });
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('bri'));
    expect(await screen.findByText('Searching…')).toBeInTheDocument();
  });

  it('reports the picked item', async () => {
    const onValueChange = vi.fn();
    render(
      <Combobox
        label="Application"
        items={APPS}
        value={null}
        onValueChange={onValueChange}
        itemToString={(a) => a.name}
        itemKey={(a) => a.id}
      />,
    );
    await chooseFromCombobox('Application', 'BrightPath Analytics');
    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith(APPS[1]));
  });
});
