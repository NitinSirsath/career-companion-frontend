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
import { Tag } from '../ui/tag';

/**
 * One role of the active provider: its model, changed in place. A new model is checked with the
 * saved key first and saved at once; a model the key cannot use changes nothing.
 */
export function ModelChoice({
  settings,
  role,
  onSaved,
}: {
  settings: AISettingsResponse;
  role: AIRole;
  onSaved: (note: string) => void;
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
    <div className="grid items-center gap-x-6 gap-y-2 border-t border-border-subtle px-6 py-4 md:grid-cols-[minmax(160px,1fr)_minmax(240px,320px)_minmax(140px,1fr)]">
      <div className="flex flex-col gap-0.5">
        <span id={labelId} className="text-sm">
          {ROLE_LABELS[role]}
        </span>
        <span className="text-xs text-text-secondary">{ROLE_HELP[role]}</span>
      </div>
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
    </div>
  );
}
