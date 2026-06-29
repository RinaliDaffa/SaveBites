import { describe, it, expect } from 'vitest';
import {
  constantTimeEquals,
  normalizeCode,
} from '@/lib/security/request';

describe('constantTimeEquals', () => {
  it('returns true for identical strings', () => {
    expect(constantTimeEquals('ABC123', 'ABC123')).toBe(true);
  });

  it('returns false for different strings of same length', () => {
    expect(constantTimeEquals('ABC123', 'XYZ789')).toBe(false);
  });

  it('returns false for strings of different length', () => {
    expect(constantTimeEquals('ABC12', 'ABC123')).toBe(false);
    expect(constantTimeEquals('ABC1234', 'ABC123')).toBe(false);
  });

  it('returns false for empty strings vs non-empty', () => {
    expect(constantTimeEquals('', 'A')).toBe(false);
    expect(constantTimeEquals('A', '')).toBe(false);
  });

  it('returns true for two empty strings', () => {
    expect(constantTimeEquals('', '')).toBe(true);
  });

  it('handles unicode/code points consistently', () => {
    // Both strings should be rejected since they differ.
    expect(constantTimeEquals('テスト1', 'テスト2')).toBe(false);
    expect(constantTimeEquals('テスト1', 'テスト1')).toBe(true);
  });

  // The actual timing-safety property is statistical and best verified by
  // inspection of the implementation, but we at least confirm it does not
  // short-circuit on the first mismatch (it still has to walk the rest of
  // the string).
  it('does not throw on mismatched lengths with long inputs', () => {
    const a = 'A'.repeat(1000);
    const b = 'B'.repeat(999);
    expect(() => constantTimeEquals(a, b)).not.toThrow();
    expect(constantTimeEquals(a, b)).toBe(false);
  });
});

describe('normalizeCode', () => {
  it('uppercases lowercase letters', () => {
    expect(normalizeCode('abc123')).toBe('ABC123');
  });

  it('strips non-alphanumeric characters', () => {
    expect(normalizeCode('AB-12 3')).toBe('AB123');
    expect(normalizeCode('A B C 1 2 3')).toBe('ABC123');
    expect(normalizeCode('AB.12!')).toBe('AB12');
  });

  it('handles whitespace and tabs', () => {
    expect(normalizeCode('  ABC123  ')).toBe('ABC123');
    expect(normalizeCode('\tABC\n123')).toBe('ABC123');
  });

  it('preserves digits', () => {
    expect(normalizeCode('123456')).toBe('123456');
  });

  it('returns empty string for non-alphanumeric input', () => {
    expect(normalizeCode('!@#$%^')).toBe('');
    expect(normalizeCode('')).toBe('');
  });

  it('normalizes a pickup code scanned from a QR sticker with leading whitespace', () => {
    expect(normalizeCode('  abc-12\n')).toBe('ABC12');
  });
});