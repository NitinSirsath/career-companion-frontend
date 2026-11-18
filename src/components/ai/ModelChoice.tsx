import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, isApiError } from '../../api/client';
import type { AISettingsResponse } from '../../contracts/ai';
import { getCatalogProvider, type AIRole } from '../../contracts/aiCatalog';
import {
  ROLE_HELP,
  ROLE_LABELS,
  modelOptions,
  modelSavedNote,
  modelValue,
} from '../../lib/aiConnections';
import { modelState, saveProblem, settingsOf } from '../../lib/aiProviderPage';
import { Select } from '../ui/select';
import { cn } from '../../lib/utils';
import { Tag } from '../ui/tag';

const FRAME = {
  laptop:
    'grid items-center gap-x-6 gap-y-2 border-t border-border-subtle px-6 py-4 md:grid-cols-[minmax(160px,1fr)_minmax(240px,320px)_minmax(140px,1fr)]',
  phone:
    'flex flex-col gap-2 border-b border-border-subtle px-[18px] py-3 text-phone-row last:border-b-0',
};

/** A role's row: a grid line on laptops, a plain row on phones with the choice under the name. */
function ModelFrame({ phone, children }: { phone: boolean; children: React.ReactNode }) {
  return <div className={FRAME[phone ? 'phone' : 'laptop']}>{children}</div>;
}

/** "Fast step" and what it does. */
function RoleName({ role, labelId, phone }: { role: AIRole; labelId: string; phone: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span id={labelId} className={phone ? undefined : 'text-sm'}>
        {ROLE_LABELS[role]}
      </span>
      <span className={cn('text-text-secondary', phone ? 'text-[13.5px]' : 'text-xs')}>
        {ROLE_HELP[role]}
      </span>
    </div>
  );
}

/**
 * One role of the active provider: its model, changed in place. A new model is checked with the
 * saved key first and saved at once; a model the key cannot use changes nothing.
 */
export function ModelChoice({
  settings,
  role,
  onSaved,
  phone = false,
}: {
  settings: AISettingsResponse;
  role: AIRole;
  onSaved: (note: string) => void;
  /** A plain row on phones, with the choice under its name. */
  phone?: boolean;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const provider = settings.provider ? getCatalogProvider(settings.provider) : undefined;
  const model = settings.models?.[role];
  if (!provider || !model) return null;
  const state = modelState(settings, model.id);
  const current = modelValue(model);
  const labelId = `ai-model-${role}`;

  async function choose(value: string) {
    if (!provider || saving || value === current) return;
    setSaving(true);
    setProblem(null);
    try {
      const response = await api.saveAIProvider(provider.id, {
        models: { [role]: value || null },
      });
      queryClient.setQueryData(['aiSettings'], settingsOf(response));
      onSaved(modelSavedNote(provider.id, value || null, role));
    } catch (err) {
      setProblem(saveProblem(err, provider).text);
      if (isApiError(err) && err.outcomeUncertain)
        queryClient.invalidateQueries({ queryKey: ['aiSettings'] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModelFrame phone={phone}>
      <RoleName role={role} labelId={labelId} phone={phone} />
      <Select<string>
        id={`${labelId}-select`}
        label={ROLE_LABELS[role]}
        hideLabel
        value={current}
        options={modelOptions(provider, role)}
        disabled={saving}
        onValueChange={(value) => void choose(value)}
      />
      <div className="flex flex-col items-start gap-1">
        {saving ? (
          <Tag>Checking and saving…</Tag>
        ) : (
          state && <Tag color={state.tone === 'success' ? 'green' : 'yellow'}>{state.label}</Tag>
        )}
        {state?.why && !saving && <span className="text-xs text-text-secondary">{state.why}</span>}
        {problem && (
          <span role="alert" className="text-xs text-danger-text">
            {problem}
          </span>
        )}
      </div>
    </ModelFrame>
  );
}
