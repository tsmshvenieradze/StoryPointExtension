// src/audit/parseLatest.ts — Source: D-13, D-14
import type { AdoComment, AuditPayload } from './types';
import { parse } from './parse';

export function parseLatest(comments: ReadonlyArray<AdoComment>): AuditPayload | null {
  // D-13: filter soft-deleted
  const live = comments.filter((c) => c.isDeleted !== true);

  // D-14: sort newest first; copy to avoid mutating caller's array (Pitfall 4)
  const sorted = [...live].sort((a, b) => b.createdDate.localeCompare(a.createdDate));

  // Fall-through: skip malformed, return first valid
  for (const c of sorted) {
    const parsed = parse(c.text);
    if (parsed !== null) return parsed;
  }
  return null;
}
