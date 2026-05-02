---
phase: 02-manifest-shell-sdk-integration
reviewed: 2026-05-02T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/ado/types.ts
  - src/entries/toolbar.tsx
  - src/entries/modal.tsx
  - vss-extension.json
  - webpack.config.cjs
  - scripts/dev-publish.cjs
  - scripts/generate-toolbar-icon.cjs
  - src/template.html
  - package.json
findings:
  blocker: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-05-02
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 2 lands a clean SDK-handshake shell. Lifecycle ordering (register → init → ready → notifyLoadSucceeded), contribution-id alignment, scope locking (`vso.work_write` only), `.env.local` git-tracking guard, and PNG-icon generation are all correct. The toolbar's permissive `actionContext` parsing (workItemId/id, array form) matches RESEARCH §Pitfall 8.

No BLOCKER-class defects were found — there is no incorrect behavior, security vulnerability, or data-loss risk that must be fixed before this phase ships.

The WARNING findings cluster around `scripts/dev-publish.cjs`: a developer-local tool, but the combination of `shell: true` + `process.argv.slice(2)` passthrough + PAT-on-command-line creates real (if low-blast-radius) hardening gaps; and a SIGINT during publish can leave `vss-extension.json` mutated on disk. The modal's silent `workItemId = 0` fallback is a Phase-3 trap — it will mask config-plumbing bugs when work item IO lands.

## Blocker Issues

None.

## Warnings

### WR-01: PAT passed on command line via `shell: true` exposes it to local process listings

**File:** `scripts/dev-publish.cjs:90-100`
**Issue:** The PAT is passed as a CLI flag (`--token`, `pat`) to `spawnSync("npx", args, { shell: true, ... })`. With `shell: true`, the args array is joined into a single command string handed to cmd.exe (or the platform shell), which means the PAT becomes part of the child process's command line. On Windows, that command line is visible to any process that can call `Get-Process` or open Task Manager → Details → "Command line" column, and it can be captured by Sysmon / EDR / shell-history tooling. PATs are bearer credentials and should never appear in process arguments.

The `(token redacted)` log line on L94 only redacts the script's *own* console output — it does nothing about the PAT being in the OS-level process table while `tfx-cli` runs.

**Fix:** Drop `shell: true` and let Node spawn `npx`/`npx.cmd` directly; on Windows you may need to point at `npx.cmd` explicitly. If you must keep shell mode for PATH resolution, switch to passing the PAT via a file:

```js
// Option A: drop shell, target npx.cmd on win32
const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";
const r = spawnSync(npxBin, args, {
  cwd: REPO_ROOT,
  stdio: ["inherit", "pipe", "pipe"],
  encoding: "utf8",
  // shell: false (default)
});

// Option B (if tfx supports it): write PAT to a temp file with 0600 perms
// and pass --auth-type pat --token-file <path>; delete in finally{}.
```

---

### WR-02: `process.argv.slice(2)` passthrough into a `shell: true` spawn is a command-injection vector

**File:** `scripts/dev-publish.cjs:91, 95-100`
**Issue:** `...process.argv.slice(2)` appends caller-supplied arguments verbatim to the tfx invocation, and `shell: true` means those arguments are interpreted by the shell. A developer (or a CI step) running `npm run dev:publish -- "; some-other-command"` would execute `some-other-command` in addition to the publish. The blast radius is small (this is a developer-only tool), but it is a textbook injection sink and trivially avoided.

**Fix:** Drop `shell: true` (see WR-01) so args are passed directly to the child process as a `argv` array — the shell is never invoked, so injection is structurally impossible. If you keep shell mode, validate or refuse extra args:

```js
const extra = process.argv.slice(2);
if (extra.length > 0) {
  console.error(`${LOG_PREFIX} extra args not supported when shell:true. Got: ${extra.join(" ")}`);
  process.exit(5);
}
```

---

### WR-03: SIGINT during publish leaves `vss-extension.json` mutated on disk

**File:** `scripts/dev-publish.cjs:79-129`
**Issue:** The script writes the candidate version into `vss-extension.json` on L82, then runs `spawnSync` which can take many seconds. If the user hits Ctrl-C, `spawnSync` returns and the process exits — but the restore on L129 only runs if execution reaches the end of the script. With `process.exit(...)` paths and an unhandled SIGINT, the manifest stays at the bumped version, polluting `git status` (D-03 explicitly lists this as a thing to avoid).

There is no `try/finally`, no `process.on("SIGINT", ...)` handler, and no `process.on("exit", ...)` snapshot restore.

**Fix:** Wrap the publish loop in `try/finally`, and additionally restore on signals:

```js
const restoreManifest = () => {
  try { fs.writeFileSync(MANIFEST, manifestSnapshot, "utf8"); } catch {}
};
process.on("SIGINT", () => { restoreManifest(); process.exit(130); });
process.on("SIGTERM", () => { restoreManifest(); process.exit(143); });

try {
  // ... existing for-loop publish logic ...
} finally {
  restoreManifest();
}
```

---

### WR-04: Modal silently falls back to `workItemId = 0` and renders anyway

**File:** `src/entries/modal.tsx:81-92`
**Issue:** If `SDK.getConfiguration()` returns no `workItemId` (or a non-number), the modal logs an error but continues to render `<Hello workItemId={0} />` — producing UI that says "Hello from Work Item #0". In Phase 3+, this same fallback path will ship — the modal will attempt field reads/writes against work item 0, hit an ADO API 404, and the user will see a confusing "work item not found" instead of "config plumbing broken." Silent zeros mask real bugs.

Work item IDs in Azure DevOps are positive integers (>= 1), so 0 is never a valid value; treating it as one is unsound.

**Fix:** Refuse to render and surface a host error UI instead:

```ts
const workItemId = typeof config?.workItemId === "number" && config.workItemId > 0
  ? config.workItemId
  : null;

if (workItemId === null) {
  console.error(`${LOG_PREFIX} workItemId missing or invalid from configuration`, config);
  await SDK.notifyLoadFailed("Modal opened without a valid workItemId in configuration.");
  return;
}

// ... existing render path with non-null workItemId ...
```

---

### WR-05: Unawaited `SDK.notifyLoadFailed(...)` in bootstrap catch can drop rejections

**File:** `src/entries/toolbar.tsx:100-103` and `src/entries/modal.tsx:100-104`
**Issue:** Both bootstrap catches call `SDK.notifyLoadFailed(...)` without `await` or `.catch(...)`. The SDK's notify methods return promises; if `notifyLoadFailed` itself rejects (e.g., the host channel is already torn down), the rejection becomes an unhandled promise rejection. With Node 20+ defaults, that triggers `unhandledRejection` warnings or process termination depending on flags. It also means the iframe's "I have failed" signal can be dropped on the floor while the local catch reports success.

**Fix:** Make the catch async-aware:

```ts
bootstrap().catch(async (err) => {
  console.error(`${LOG_PREFIX} bootstrap failed`, err);
  try {
    await SDK.notifyLoadFailed(err instanceof Error ? err : String(err));
  } catch (notifyErr) {
    console.error(`${LOG_PREFIX} notifyLoadFailed itself failed`, notifyErr);
  }
});
```

---

### WR-06: `.env.local` parser silently ignores quoted values, lowercase keys, and inline whitespace

**File:** `scripts/dev-publish.cjs:38-43`
**Issue:** The regex `^([A-Z_][A-Z0-9_]*)=(.*)$` enforces uppercase keys (so `tfx_pat=...` is silently dropped), and `(.*)` does not strip surrounding quotes (`TFX_PAT="abc"` ends up storing the literal string `"abc"` including quote characters, which `tfx-cli` then sends to the Marketplace and gets a 401). The existing failure path ("TFX_PAT missing from .env.local") is misleading in the lowercase case (the key was found but rejected); the quoted case fails much later with an opaque auth error.

This is also a divergence from `dotenv` semantics, which most developers will assume.

**Fix:** Loosen the regex and strip quotes:

```js
for (const rawLine of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;
  const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
  if (!m) {
    console.warn(`${LOG_PREFIX} ignoring unparseable .env.local line: ${line}`);
    continue;
  }
  let value = m[2];
  // Strip matching surrounding quotes
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (!process.env[m[1]]) process.env[m[1]] = value;
}
```

## Info

### IN-01: Generated `.vsix` files sitting in repo root

**File:** repo root (e.g., `TsezariMshvenieradzeExtensions.story-point-calculator-0.1.4.vsix`)
**Issue:** Four `.vsix` files (1.5 MB each, ~6 MB total) are sitting in the repo root from prior `tfx extension publish` runs. They are correctly gitignored (`.gitignore:13: *.vsix`), so they will not leak into history, but they clutter `ls`/IDE file trees and grow indefinitely as the dev:publish loop iterates. Consider directing tfx output into `dist/` or `.tfx-cache/` (already gitignored).

**Fix:** Pass `--output-path dist/` (or a similar dedicated dir) to `tfx extension publish` in `dev-publish.cjs`, or add a `prepublish` cleanup step that removes existing `*.vsix` from repo root.

---

### IN-02: Webpack `clean: false` allows stale chunks to ship

**File:** `webpack.config.cjs:12`
**Issue:** `output.clean: false` means deleted entry files leave their old `.js` and `.html` artifacts in `dist/`. The vss-extension.json `files: [{ "path": "dist", ... }]` packages everything in `dist/` — so a removed contribution's HTML/JS will still ship in the `.vsix` until someone runs `npm run clean`. Phase 2 has only two stable entries so the impact is zero today, but the trap will bite when entries are renamed or removed.

**Fix:** Either set `clean: true` on each config (Webpack 5 supports per-config), or add a pre-build `rimraf dist` to the `build`/`build:dev` scripts:

```jsonc
// package.json
"build": "rimraf dist && webpack --mode production",
"build:dev": "rimraf dist && webpack --mode development",
```

---

### IN-03: Webpack asset rule includes `svg` and `png` types that no entry currently imports

**File:** `webpack.config.cjs:33-36`
**Issue:** `test: /\.(woff2?|ttf|eot|svg|png)$/` declares font + image asset handling, but neither `toolbar.tsx` nor `modal.tsx` imports any image asset directly. The rule is harmless until something starts importing — and at that point it will silently emit hashed asset files that won't be referenced from the manifest's static `images/toolbar-icon.png` path. Just be aware the rule is currently dead code.

**Fix:** No change required for Phase 2. When future entries do import images, audit the rule to make sure asset URLs resolve correctly under the extension iframe's `publicPath: ''`.

---

### IN-04: Toolbar comment incorrectly claims `openCustomDialog` returns void

**File:** `src/entries/toolbar.tsx:72`
**Issue:** Comment says "openCustomDialog returns void (verified type signature)." In `azure-devops-extension-api/HostPageLayout`, `openCustomDialog<T>` returns `Promise<T | undefined>` — it resolves with the dialog's `onClose` callback return value (typed `T`) when the dialog closes. The behavior on this line happens to be fine because the resolution is ignored, but the comment is wrong and may mislead Phase 3/4 work that wants to await the dialog result instead of the current onClose callback.

**Fix:** Update the comment, or actually consume the return value in Phase 3 (since the calculator will want to wait for the modal's apply/cancel result):

```ts
// openCustomDialog returns Promise<T | undefined> resolved when the dialog
// closes; T is the value passed to dialog.close(value). We currently
// ignore the resolution and rely on onClose for side-effects.
```

---

### IN-05: Hardcoded `--share-with cezari` ties dev-publish to a specific Marketplace tenant

**File:** `scripts/dev-publish.cjs:88`
**Issue:** The `--share-with` target is hardcoded to the `cezari` Marketplace organization. If another developer on the team runs `npm run dev:publish` with their own PAT, the publish either fails (no rights to share with `cezari`) or succeeds but shares with someone else's org rather than the developer's own. This is a usability/papercut concern, not a correctness one.

**Fix:** Read the share target from `.env.local`:

```js
const shareWith = process.env.TFX_SHARE_WITH ?? "cezari";
// ...
const args = [
  "tfx", "extension", "publish",
  "--manifest-globs", "vss-extension.json",
  "--share-with", shareWith,
  // ...
];
```

---

_Reviewed: 2026-05-02_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
