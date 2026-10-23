import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AIConnection, AISettingsResponse } from '../contracts/ai';
import { getCatalogProvider } from '../contracts/aiCatalog';
import {
  activatedNote,
  canConnectMore,
  connectionTag,
  inactiveCheckNote,
  keyLine,
  modelOptions,
  modelSavedNote,
  modelValue,
  removeChoices,
  removedNote,
  spareProvider,
} from '../lib/aiConnections';

const connection = (provider: string, fields: Partial<AIConnection> = {}): AIConnection => ({
  provider,
  active: false,
  state: 'READY',
  reason: null,
  modelId: null,
  failure: null,
  models: null,
  verified: true,
  lastCheckedAt: null,
  consentCurrent: true,
  ...fields,
});

const settings = (connections: AIConnection[], fields: Partial<AISettingsResponse> = {}) =>
  ({
    provider: connections.find((c) => c.active)?.provider ?? null,
    offeredProviders: ['gemini', 'openai', 'anthropic'],
    access: { state: 'READY' },
    waitingEmails: 0,
    connections,
    ...fields,
  }) as AISettingsResponse;

const gemini = connection('gemini', { active: true });

describe('connecting more providers', () => {
  it('offers "Connect a provider" once one is connected, while another one is free', () => {
    expect(canConnectMore(settings([]))).toBe(false);
    expect(canConnectMore(settings([gemini]))).toBe(true);
    expect(canConnectMore(settings([gemini, connection('openai'), connection('anthropic')]))).toBe(
      false,
    );
  });
});

describe('the other providers', () => {
  it('can take over only without a key problem', () => {
    const broken = connection('openai', { state: 'NEEDS_ATTENTION', reason: 'KEY_REJECTED' });
    expect(spareProvider(settings([gemini, broken]))).toBeNull();
    expect(spareProvider(settings([gemini, broken, connection('anthropic')]))?.provider).toBe(
      'anthropic',
    );
  });

  it('tags each one by its state, and an unconfirmed key as not confirmed', () => {
    expect(connectionTag(connection('openai'))).toEqual({ label: 'Ready', color: 'green' });
    expect(connectionTag(connection('openai', { verified: false }))).toEqual({
      label: 'Not confirmed',
      color: 'yellow',
    });
    expect(connectionTag(connection('openai', { state: 'NEEDS_ATTENTION' }))).toEqual({
      label: 'Needs attention',
      color: 'red',
    });
    expect(connectionTag(connection('openai', { state: 'LIMITED' }))).toEqual({
      label: 'Limited',
      color: 'yellow',
    });
  });
});

describe('the key line', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
  afterEach(() => vi.useRealTimers());

  it('says whether the key was verified, and when it was last checked', () => {
    const at = new Date(2026, 9, 22, 9, 53).toISOString();
    expect(keyLine({ verified: true, lastCheckedAt: at })).toBe(
      'Key verified · last checked Oct 22, 9:53 AM',
    );
    expect(keyLine({ verified: false, lastCheckedAt: null })).toBe('Key saved');
  });
});

describe('models in place', () => {
  const gem = getCatalogProvider('gemini')!;

  it('lists the recommended model first, as the empty value, then the other tested ones', () => {
    expect(modelOptions(gem, 'detailed')).toEqual([
      { value: '', label: 'Gemini 3.8 Flash (recommended)' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    ]);
  });

  it('shows a chosen model as itself, and a recommended or replaced one as recommended', () => {
    expect(modelValue({ id: 'gemini-2.5-flash', source: 'SELECTED' })).toBe('gemini-2.5-flash');
    expect(modelValue({ id: 'gemini-3.8-flash', source: 'RECOMMENDED' })).toBe('');
    expect(modelValue({ id: 'gemini-3.8-flash', source: 'REPLACED_RETIRED' })).toBe('');
  });

  it('says what new mails use after a change', () => {
    expect(modelSavedNote('gemini', 'gemini-2.5-flash', 'fast')).toBe(
      'Saved. New mails use Gemini 2.5 Flash for fast screening.',
    );
    expect(modelSavedNote('gemini', null, 'detailed')).toBe(
      'Saved. New mails use the recommended model for detailed analysis.',
    );
  });
});

describe('removing and switching', () => {
  it('asks who reads new mail next only when the active one goes and another can', () => {
    const openai = connection('openai');
    expect(removeChoices(settings([gemini, openai]), 'gemini')).toEqual([
      { value: 'openai', label: 'OpenAI reads new mails' },
      { value: 'none', label: 'No provider: new mails wait' },
    ]);
    expect(removeChoices(settings([gemini, openai]), 'openai')).toEqual([]);
    expect(removeChoices(settings([gemini]), 'gemini')).toEqual([]);
    const broken = connection('openai', { state: 'NEEDS_ATTENTION' });
    expect(removeChoices(settings([gemini, broken]), 'gemini')).toEqual([]);
  });

  it('says when no provider reads the mail after a removal', () => {
    expect(removedNote(settings([gemini]), 'openai')).toBe('Your OpenAI key is removed.');
    expect(removedNote(settings([]), 'gemini')).toBe('Your Google Gemini key is removed.');
    expect(removedNote(settings([connection('openai')]), 'gemini')).toBe(
      'Your Google Gemini key is removed. No provider reads your mail now.',
    );
  });

  it('says that waiting mails go to the provider made active', () => {
    expect(activatedNote(settings([gemini]), 'gemini')).toBe('Google Gemini reads new mails now.');
    expect(activatedNote(settings([gemini], { waitingEmails: 2 }), 'gemini')).toBe(
      'Google Gemini reads new mails now. Waiting emails are being processed.',
    );
  });

  it('words the check of a provider that is not active', () => {
    const answer = (verification: 'VERIFIED' | 'REJECTED' | 'INCONCLUSIVE') => ({
      ...settings([gemini]),
      verification,
      verificationFailure: null,
    });
    expect(inactiveCheckNote(answer('VERIFIED'), 'openai')).toBe(
      'OpenAI confirmed the key and models.',
    );
    expect(inactiveCheckNote(answer('REJECTED'), 'openai')).toBe(
      'OpenAI refused the key. Replace it to use OpenAI.',
    );
    expect(inactiveCheckNote(answer('INCONCLUSIVE'), 'openai')).toBe(
      'OpenAI did not confirm right now. Try again later.',
    );
  });
});
