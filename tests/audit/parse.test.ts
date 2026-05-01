// tests/audit/parse.test.ts — Source: D-20, D-23, D-24; AUDIT-03, AUDIT-04, AUDIT-06
import { describe, it, expect } from 'vitest';
import { parse } from '../../src/audit/parse';

const VALID_PAYLOAD = {
  sp: 5, c: 'Hard' as const, u: 'Medium' as const, e: 'Easy' as const, schemaVersion: 1 as const,
};

describe('parse: edge cases (D-23, AUDIT-03, AUDIT-04, AUDIT-06)', () => {
  it.each([
    {
      name: 'plain sentinel + human line',
      body: '<!-- sp-calc:v1 {"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":1} -->\nStory Points: 5 (Complexity=Hard, Uncertainty=Medium, Effort=Easy)',
      expected: VALID_PAYLOAD,
    },
    {
      name: 'HTML-wrapped in <p>',
      body: '<p><!-- sp-calc:v1 {"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":1} --></p>',
      expected: VALID_PAYLOAD,
    },
    {
      name: 'HTML-wrapped in <div>',
      body: '<div><!-- sp-calc:v1 {"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":1} --></div>',
      expected: VALID_PAYLOAD,
    },
    {
      name: 'NBSP between marker and JSON',
      // The \u00A0 escape between `sp-calc:v1` and `{` is U+00A0 (non-breaking space).
      // The executor MUST type the literal escape sequence \u00A0 (six characters) -- do NOT
      // paste a literal NBSP byte here (invisible; lost in copy-paste). TypeScript/JS
      // interpret \u00A0 as the U+00A0 codepoint at runtime, which is what the parser's
      // normalizeNbsp regex /\u00A0/g matches.
      body: '<!-- sp-calc:v1\u00A0{"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":1} -->',
      expected: VALID_PAYLOAD,
    },
    {
      name: 'extra whitespace inside delimiters',
      body: '<!--   sp-calc:v1   {"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":1}   -->',
      expected: VALID_PAYLOAD,
    },
    {
      name: 'mid-comment user edit to human-readable line',
      body: '<!-- sp-calc:v1 {"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":1} -->\nStory Points: 5 -- actually I think this should be 8 -- (Complexity=Hard, Uncertainty=Medium, Effort=Easy)',
      expected: VALID_PAYLOAD,
    },
    {
      name: 'lowercase labels accepted (D-04 case-insensitive)',
      body: '<!-- sp-calc:v1 {"sp":5,"c":"hard","u":"medium","e":"easy","schemaVersion":1} -->',
      expected: VALID_PAYLOAD, // canonicalized to Title Case
    },
    {
      name: 'malformed JSON inside sentinel returns null (D-12)',
      body: '<!-- sp-calc:v1 {bad json} -->',
      expected: null,
    },
    {
      name: 'no sentinel at all returns null',
      body: 'Just a plain comment with no machine-readable payload',
      expected: null,
    },
    {
      name: 'human-readable line only (no sentinel) returns null',
      body: 'Story Points: 5 (Complexity=Hard, Uncertainty=Medium, Effort=Easy)',
      expected: null,
    },
    {
      name: 'wrong marker (sp-calc:v2) returns null (D-09)',
      body: '<!-- sp-calc:v2 {"sp":5} -->',
      expected: null,
    },
    {
      name: 'schemaVersion=2 returns null (D-06)',
      body: '<!-- sp-calc:v1 {"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":2} -->',
      expected: null,
    },
    {
      name: 'schemaVersion=0 returns null (D-08)',
      body: '<!-- sp-calc:v1 {"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":0} -->',
      expected: null,
    },
    {
      name: 'unknown sp value (4 — not Fibonacci) returns null',
      body: '<!-- sp-calc:v1 {"sp":4,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":1} -->',
      expected: null,
    },
    {
      name: 'unknown label (Trivial) returns null',
      body: '<!-- sp-calc:v1 {"sp":5,"c":"Trivial","u":"Medium","e":"Easy","schemaVersion":1} -->',
      expected: null,
    },
    {
      name: 'non-string label value (number) returns null',
      // Exercises toCanonicalLevel's typeof !== 'string' branch (parse.ts line 20).
      body: '<!-- sp-calc:v1 {"sp":5,"c":42,"u":"Medium","e":"Easy","schemaVersion":1} -->',
      expected: null,
    },
    {
      name: 'empty body returns null',
      body: '',
      expected: null,
    },
  ])('$name', ({ body, expected }) => {
    expect(parse(body)).toEqual(expected);
  });
});
