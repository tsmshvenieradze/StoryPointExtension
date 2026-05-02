// src/audit/parse.ts — Source: D-04, D-06, D-08, D-09, D-10, D-11, D-12, D-17;
// regex verified against all D-23 cases live in Node 24.15
import type { Level } from '../calc/levels';
import { LEVELS } from '../calc/levels';
import type { FibonacciSp } from '../calc/fibonacci';
import type { AuditPayload } from './types';

const FIB_VALUES: ReadonlySet<FibonacciSp> = new Set<FibonacciSp>([0.5, 1, 2, 3, 5, 8, 13]);
const SENTINEL_RX = /<!--\s*sp-calc:v1\s+(\{[^{}]*\})\s*-->/;

/** Replace ONLY non-breaking space (U+00A0) with ASCII space.
 *  Do NOT collapse other whitespace — internal JSON whitespace is preserved
 *  and JSON.parse handles it natively. (RESEARCH Pitfall 2.) */
function normalizeNbsp(s: string): string {
  return s.replace(/ /g, ' ');
}

/** Decode the HTML entities ADO's modern Comments storage applies to user
 *  input. When a user posts a comment via the Discussion field (any editor
 *  mode), ADO's web layer escapes `<`, `>`, `"`, and `'` before persisting,
 *  so the sentinel `<!-- sp-calc:v1 {"sp":5,...} -->` round-trips through
 *  the API as `&lt;!-- sp-calc:v1 {&quot;sp&quot;:5,...} --&gt;`. Decode
 *  these entities before running SENTINEL_RX so the regex (and the inner
 *  JSON.parse) can match either the raw or the encoded form transparently.
 *
 *  03-04 cezari finding: regex from Phase 1 didn't account for HTML-mode
 *  storage encoding. Decoded inline (no DOMParser) so the parser stays a
 *  pure function with zero ADO/DOM dependencies for unit testability.
 *
 *  Decode `&amp;` LAST: prevents `&amp;quot;` (a literal `&quot;` in the
 *  source, double-encoded for storage) from being mis-decoded to `"`. */
function decodeAdoEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Title-Case lookup — case-insensitive match against LEVELS. (D-04) */
function toCanonicalLevel(input: unknown): Level | null {
  if (typeof input !== 'string') return null;
  const lc = input.toLowerCase();
  for (const lvl of LEVELS) {
    if (lvl.toLowerCase() === lc) return lvl;
  }
  return null;
}

export function parse(commentBody: string): AuditPayload | null {
  if (typeof commentBody !== 'string' || commentBody.length === 0) return null;
  const decoded = decodeAdoEntities(commentBody);
  const normalized = normalizeNbsp(decoded);
  const match = normalized.match(SENTINEL_RX);
  if (!match || !match[1]) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(match[1]);
  } catch {
    return null;  // D-12: never throw on user input
  }

  // Note: the regex's `\{[^{}]*\}` capture guarantees JSON.parse — when it succeeds —
  // returns a flat object literal. A `typeof raw !== 'object' || raw === null` guard
  // would be unreachable from any input passing the regex; omitted to keep coverage 100%.
  const obj = raw as Record<string, unknown>;

  // schemaVersion strictly === 1 per D-06, D-08
  if (obj['schemaVersion'] !== 1) return null;

  // sp must be a known Fibonacci value
  const sp = obj['sp'];
  if (typeof sp !== 'number' || !FIB_VALUES.has(sp as FibonacciSp)) return null;

  // c/u/e: case-insensitive lookup per D-04
  const c = toCanonicalLevel(obj['c']);
  const u = toCanonicalLevel(obj['u']);
  const e = toCanonicalLevel(obj['e']);
  if (c === null || u === null || e === null) return null;

  return { sp: sp as FibonacciSp, c, u, e, schemaVersion: 1 };
}
