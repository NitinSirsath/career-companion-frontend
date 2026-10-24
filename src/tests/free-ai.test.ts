import { describe, expect, it } from 'vitest';
import type { AIConnection, AISettingsResponse } from '../contracts/ai';
import {
  canConnectMore,
  connectionTag,
  modelsLine,
  providersToConnect,
  removedNote,
} from '../lib/aiConnections';
import { accessCopy } from '../lib/aiLabels';
import { freeAIBackupOffered, freeAICopy, freeAIOffered, ownKeyProviders } from '../lib/freeAI';

const LUNA = { id: 'openai/gpt-6-luna', source: 'RECOMMENDED' as const };
const free: AIConnection = {
  provider: 'career-companion',
  active: true,
  state: 'READY',
  reason: null,
  modelId: null,
  failure: null,
  models: { fast: LUNA, detailed: LUNA },
  verified: true,
  lastCheckedAt: null,
  consentCurrent: true,
};
const settings = (overrides: Partial<AISettingsResponse> = {}): AISettingsResponse => ({
  configured: true,
  provider: 'career-companion',
  offeredProviders: ['openrouter', 'career-companion'],
  models: { fast: LUNA, detailed: LUNA },
  access: {
    state: 'READY',
    reason: null,
    modelId: null,
    resumesAt: null,
    failure: null,
    pauses: [],
    verified: true,
    lastCheckedAt: null,
  },
  lastFailure: null,
  usageToday: { day: '2026-10-24', calls: 0, inputTokens: 0, outputTokens: 0 },
  safetyLimit: { callsPerDay: 250, resetsAt: '2026-10-25T00:00:00.000Z' },
  waitingEmails: 0,
  needsYourOk: { emails: 0, model: null, lastTriedAt: null, tries: 0 },
  consent: null,
  connections: [free],
  ...overrides,
});
const waiting = (reason: AISettingsResponse['access']['reason'], waitingEmails = 1) =>
  settings({ waitingEmails, access: { ...settings().access, state: 'LIMITED', reason } });

describe('the free AI', () => {
  it('is offered only when the server says so, and is not a provider to add a key for', () => {
    expect(freeAIOffered(settings())).toBe(true);
    expect(freeAIOffered(settings({ offeredProviders: ['openrouter'] }))).toBe(false);
    expect(ownKeyProviders(settings())).toEqual(['openrouter']);
    expect(providersToConnect(settings())).toEqual(['openrouter']);
    expect(canConnectMore(settings({ offeredProviders: ['career-companion'] }))).toBe(false);
  });

  it('is offered as a backup only next to another active provider, until it is added', () => {
    const own = { ...free, provider: 'openrouter' };
    expect(freeAIBackupOffered(settings({ connections: [own] }))).toBe(true);
    expect(freeAIBackupOffered(settings({ connections: [own, { ...free, active: false }] }))).toBe(
      false,
    );
    expect(freeAIBackupOffered(settings({ connections: [{ ...own, active: false }] }))).toBe(false);
    expect(freeAIBackupOffered(settings({ connections: [] }))).toBe(false);
    expect(
      freeAIBackupOffered(settings({ offeredProviders: ['openrouter'], connections: [own] })),
    ).toBe(false);
  });

  it('names its pause as a pause, and each model once', () => {
    expect(connectionTag({ ...free, state: 'LIMITED' })).toEqual({
      label: 'Paused',
      color: 'yellow',
    });
    expect(connectionTag({ ...free, provider: 'openrouter', state: 'LIMITED' }).label).toBe(
      'Limited',
    );
    expect(modelsLine(free)).toBe('GPT-6 Luna');
    expect(removedNote(settings({ connections: [] }), 'career-companion')).toBe(
      'Career Companion free AI is removed.',
    );
  });

  it('says what each wait means, that it ends by itself, and offers the own key', () => {
    expect(freeAICopy(settings())).toBeNull();
    expect(freeAICopy(waiting('SAFETY_LIMIT'))).toBeNull();
    const busy = freeAICopy(waiting('FREE_AI_BUSY', 12))!;
    expect(busy.title).toBe('The free AI is busy right now.');
    expect(busy.detail).toContain('Your 12 new mails are waiting in line');
    expect(busy.fix).toEqual({ label: 'Connect your own key', to: '/ai' });
    expect(freeAICopy(waiting('FREE_AI_BUDGET'))?.detail).toContain('Your 1 new mail is waiting');
    expect(freeAICopy(waiting('FREE_AI_PROBLEM', 0))?.detail).toContain(
      'There is nothing for you to do. New mails wait',
    );
    expect(freeAICopy(waiting('FREE_AI_OFF'))?.title).toBe('The free AI is switched off for now.');
    // The Mails page notice uses the same words.
    expect(accessCopy(waiting('FREE_AI_BUSY'))?.title).toBe('The free AI is busy right now.');
  });
});
