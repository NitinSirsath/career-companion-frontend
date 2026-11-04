import { describe, expect, it } from 'vitest';
import { initials } from '../components/ui/avatar';
import { avatarTone } from '../lib/avatarTone';

describe('avatar', () => {
  it('gives the same name the same colour, whatever its case or spacing', () => {
    expect(avatarTone('Maya Chen')).toBe(avatarTone('  maya   CHEN '));
    expect(avatarTone('Maya Chen')).toMatch(/^bg-\[var\(--avatar-[1-6]\)\]/);
  });

  it('spreads names over the six colours', () => {
    const names = ['Riya Kapoor', 'Maya Chen', 'Arjun Mehta', 'Quanta Labs Hiring', 'Harbor Lane'];
    expect(new Set(names.map(avatarTone)).size).toBeGreaterThan(2);
  });

  it('takes the first letters of up to two words', () => {
    expect(initials('Maya Chen')).toBe('MC');
    expect(initials('Quanta Labs Hiring')).toBe('QL');
  });
});
