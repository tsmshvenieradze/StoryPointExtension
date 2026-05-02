// src/field/index.ts — Source: D-21 (CONTEXT.md) public API.
// The vitest reset helper is intentionally NOT re-exported here — tests
// import it directly from `../../src/field/FieldResolver` (deep path) so
// the public API stays minimal.
export { resolve } from "./FieldResolver";
export type { ResolveArgs } from "./FieldResolver";
export type { ResolvedField } from "./types";
