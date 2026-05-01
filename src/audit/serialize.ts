// src/audit/serialize.ts — Source: D-01, D-02; verified determinism in Node 24.15
import type { AuditPayload } from './types';

const SENTINEL_KEYS: ReadonlyArray<keyof AuditPayload> = ['sp', 'c', 'u', 'e', 'schemaVersion'];

export function serialize(payload: AuditPayload): string {
  // Replacer array enforces key order and filters extras. No `space` arg → no inner whitespace.
  const json = JSON.stringify(payload, [...SENTINEL_KEYS] as string[]);
  const human = `Story Points: ${payload.sp} (Complexity=${payload.c}, Uncertainty=${payload.u}, Effort=${payload.e})`;
  return `<!-- sp-calc:v1 ${json} -->\n${human}`;
}
