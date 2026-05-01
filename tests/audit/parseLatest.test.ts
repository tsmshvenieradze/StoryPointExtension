// tests/audit/parseLatest.test.ts — Source: D-13, D-14, AUDIT-04, AUDIT-05, AUDIT-06
import { describe, it, expect } from 'vitest';
import { parseLatest } from '../../src/audit/parseLatest';
import type { AdoComment, AuditPayload } from '../../src/audit/types';

const make = (id: number, dateIso: string, text: string, isDeleted = false): AdoComment =>
  ({ id, createdDate: dateIso, text, isDeleted });

const VALID = (sp: number, c = 'Hard', u = 'Medium', e = 'Easy') =>
  `<!-- sp-calc:v1 {"sp":${sp},"c":"${c}","u":"${u}","e":"${e}","schemaVersion":1} -->`;

describe('parseLatest (AUDIT-05)', () => {
  it('returns null on empty input', () => {
    expect(parseLatest([])).toBeNull();
  });

  it('returns null when no comments contain sentinels', () => {
    expect(parseLatest([
      make(1, '2026-01-01T00:00:00Z', 'Plain comment 1'),
      make(2, '2026-01-02T00:00:00Z', 'Plain comment 2'),
    ])).toBeNull();
  });

  it('returns the parsed payload from a single sentinel comment', () => {
    const result = parseLatest([
      make(1, '2026-01-01T00:00:00Z', VALID(5)),
    ]);
    expect(result).toEqual<AuditPayload>({ sp: 5, c: 'Hard', u: 'Medium', e: 'Easy', schemaVersion: 1 });
  });

  it('returns the newest of multiple valid sentinels (D-14)', () => {
    const result = parseLatest([
      make(1, '2026-01-01T00:00:00Z', VALID(3)),
      make(2, '2026-04-01T00:00:00Z', VALID(8, 'Very Hard', 'Hard', 'Hard')),  // newest
      make(3, '2026-03-01T00:00:00Z', VALID(2, 'Easy', 'Easy', 'Easy')),
    ]);
    expect(result?.sp).toBe(8);
    expect(result?.c).toBe('Very Hard');
  });

  it('falls through to older valid when newest is malformed (D-14)', () => {
    const result = parseLatest([
      make(1, '2026-01-01T00:00:00Z', VALID(3)),
      make(2, '2026-04-01T00:00:00Z', '<!-- sp-calc:v1 {bad} -->'),  // newest, malformed
    ]);
    expect(result?.sp).toBe(3);
  });

  it('skips isDeleted: true comments (D-13)', () => {
    const result = parseLatest([
      make(1, '2026-04-01T00:00:00Z', VALID(8, 'Very Hard', 'Hard', 'Hard'), true), // newest but deleted
      make(2, '2026-01-01T00:00:00Z', VALID(3)),
    ]);
    expect(result?.sp).toBe(3);
  });

  it('does not mutate the input array', () => {
    const arr: AdoComment[] = [
      make(1, '2026-01-01T00:00:00Z', VALID(3)),
      make(2, '2026-04-01T00:00:00Z', VALID(5)),
    ];
    const snapshot = [...arr];
    parseLatest(arr);
    expect(arr).toEqual(snapshot);
  });
});
