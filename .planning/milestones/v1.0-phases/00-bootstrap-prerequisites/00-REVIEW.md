---
phase: 00-bootstrap-prerequisites
reviewed: 2026-05-01T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - .gitignore
  - .npmrc
  - LICENSE
  - README.md
  - package.json
  - scripts/generate-placeholder-icon.cjs
  - src/entries/modal.tsx
  - src/entries/toolbar.tsx
  - src/template.html
  - tests/smoke.test.ts
  - tsconfig.json
  - vitest.config.ts
  - vss-extension.json
  - webpack.config.cjs
findings:
  blocker: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 0: Code Review Report

**Reviewed:** 2026-05-01
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 0 is scaffolding-only. Manifest identity (publisher `TsezariMshvenieradzeExtensions`, id `story-point-calculator`, version `0.1.0`, `public: false`), the locked `vso.work_write` scope, the two contribution IDs, and the four pinned dependencies (`azure-devops-extension-sdk@4.2.0`, `azure-devops-extension-api@4.270.0`, `azure-devops-ui@2.272.0`, `tfx-cli@0.23.1`) all match the plan exactly. The React 18 override block is present and correctly written with npm `$react`/`$react-dom` references. The placeholder icon generator produces a valid 128x128 RGBA PNG. The smoke test exercises the Vitest globals path the tsconfig is configured for.

No BLOCKER-class defects (security, correctness, or data-loss) were found. The four WARNING-class findings concern packaging hygiene that will bite at publish time, a secret-leakage gap in `.gitignore` that bootstrap should set now, and a typecheck gap that lets `vitest.config.ts` errors slip through `npm run typecheck`. INFO items are minor.

## Warnings

### WR-01: `npm run package` writes `.vsix` into the directory it is packaging

**File:** `package.json:21`
**Issue:** The `package` script runs `tfx extension create --manifest-globs vss-extension.json --output-path dist/`. The manifest declares `files: [{ "path": "dist", "addressable": true }]` (`vss-extension.json:21`), so the entire `dist/` tree is included in the `.vsix`. On a second invocation of `npm run package`, the previously-produced `dist/*.vsix` is bundled INTO the new `.vsix`, doubling size each run. This will land as a real bug the first time CI/CD runs `package` twice without an intervening `clean`, and exposes the prior `.vsix` to anyone who installs the extension.
**Fix:** Output the `.vsix` to a sibling directory, e.g.:
```json
"package": "tfx extension create --manifest-globs vss-extension.json --output-path build/"
```
Then add `build/` to `.gitignore`. Alternatively, run `npm run clean` before each `package`, but the directory separation is more robust.

### WR-02: `.gitignore` does not exclude `.env*` files

**File:** `.gitignore:1-31`
**Issue:** `.gitignore` covers `node_modules/`, build output, `*.vsix`, and IDE files, but has no `.env`, `.env.local`, `.env.*.local`, or `*.pem`/`*.key` entries. Phase 5 will introduce a Marketplace PAT and Azure Pipelines service connection. While the plan documents that the PAT lives in pipeline secret variables, a developer running `tfx login` locally is prompted for a PAT and can plausibly persist it to a `.env` file out of habit. Bootstrap is the correct phase to set this defense-in-depth pattern; adding it later does not retroactively scrub leaked history.
**Fix:** Append to `.gitignore`:
```
# Secrets / local environment
.env
.env.*
!.env.example
*.pem
*.key
```

### WR-03: `vss-extension.json` `files` entry is overly broad — bundles every `dist/` artifact into the published `.vsix`

**File:** `vss-extension.json:20-23`
**Issue:** `"files": [{ "path": "dist", "addressable": true }, { "path": "images", "addressable": true }]` includes everything under `dist/` in the published package and makes it addressable by URL. As soon as Phase 2 produces source maps, vendor chunks, or accidental coverage output ends up in `dist/` (e.g., the `package` script's own `.vsix` per WR-01), it ships to the Marketplace and is publicly fetchable from the extension's CDN URL. For an extension whose purpose is structured estimation, source-map disclosure is low impact, but the same broad pattern in a future extension would leak business logic.
**Fix:** Enumerate exactly the assets the host needs to load:
```json
"files": [
  { "path": "dist/toolbar.html", "addressable": true },
  { "path": "dist/toolbar.js", "addressable": true },
  { "path": "dist/modal.html", "addressable": true },
  { "path": "dist/modal.js", "addressable": true },
  { "path": "images/icon.png", "addressable": true }
]
```
This is a Phase 5 publishing concern but the manifest pattern is set in Phase 0; flagging now so it is not forgotten.

### WR-04: `tsconfig.json` `include` excludes `vitest.config.ts` — type errors there bypass `npm run typecheck`

**File:** `tsconfig.json:23`
**Issue:** `include: ["src/**/*", "tests/**/*"]` does not match the root-level `vitest.config.ts`. `tsc --noEmit` (the `typecheck` script at `package.json:14`) therefore never type-checks the Vitest config. A typo such as `enviroment: 'node'` (instead of `environment`) silently disables the intended setting and the smoke loop reports green. `webpack.config.cjs` and `scripts/generate-placeholder-icon.cjs` are correctly outside TS scope (they are `.cjs`), but `vitest.config.ts` is genuinely TypeScript and should be type-checked.
**Fix:** Add the config file to `include`:
```json
"include": ["src/**/*", "tests/**/*", "vitest.config.ts"]
```

## Info

### IN-01: `console.log` debug calls in production entry points

**File:** `src/entries/modal.tsx:5`, `src/entries/toolbar.tsx:6`
**Issue:** Both entry stubs end with `console.log(...)`. Phase 0 ships these intentionally (entries must exist for webpack to resolve), but if a release build is produced today the logs land in user browsers. Track for removal in Phase 2 when SDK wiring replaces these stubs.
**Fix:** Either gate behind `if (process.env.NODE_ENV !== 'production')` for the placeholder lifetime, or remove during Phase 2 entry rewrite.

### IN-02: `src/template.html` is missing `lang` and `viewport`

**File:** `src/template.html:2-5`
**Issue:** The HTML lacks `<html lang="en">` and `<meta name="viewport" content="width=device-width, initial-scale=1">`. The host iframe sets sizing externally, so the viewport meta is low impact, but the missing `lang` is an accessibility/screen-reader gap that the modal will inherit when Phase 2 mounts content. Easier to add now (one template) than retrofit later.
**Fix:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Story Point Calculator</title>
</head>
```

### IN-03: `webpack.config.cjs` disables performance hints

**File:** `webpack.config.cjs:48`
**Issue:** `performance: { hints: false }` silences webpack's bundle-size warnings. CLAUDE.md states the `.vsix` should be lean and that `azure-devops-ui` adds 150-250 KB on its own. Without hints, regressions are invisible. Acceptable for Phase 0 stubs (no real bundle yet), but should be re-enabled before Phase 5 publish.
**Fix:** Remove the line, or set explicit budgets:
```js
performance: {
  hints: mode === 'production' ? 'warning' : false,
  maxAssetSize: 350 * 1024,
  maxEntrypointSize: 400 * 1024,
}
```

### IN-04: `vitest.config.ts` coverage exclude pattern is redundant

**File:** `vitest.config.ts:11-12`
**Issue:** `coverage.include: ['src/**/*.ts']` already excludes `.tsx` files (the glob does not match the `.tsx` extension), so the explicit `exclude: ['src/entries/**', 'src/**/*.tsx']` only meaningfully excludes `src/entries/**`. The `src/**/*.tsx` portion is dead config. Not a bug, but it implies coverage tracks `.tsx` by default when it does not.
**Fix:** Drop the redundant pattern:
```ts
exclude: ['src/entries/**'],
```

### IN-05: `README.md` development snippet omits `npm run build`

**File:** `README.md:9-14`
**Issue:** The README lists `npm ci`, `typecheck`, `test`, `build:dev` but not the production `build`. A new contributor running through the README never exercises the production webpack path, which has different `devtool` and minification behavior than `build:dev`. The Phase 0 fresh-clone smoke loop is `npm ci && npm run typecheck && npm test`, so omitting `build` does not affect the gate, but Phase 5 publish will fail differently from a passing local checkout if `build:dev` was the only path tried.
**Fix:** Add the production command:
```bash
npm ci
npm run typecheck
npm test
npm run build:dev   # development bundle
npm run build       # production bundle (use before npm run package)
```

---

_Reviewed: 2026-05-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
