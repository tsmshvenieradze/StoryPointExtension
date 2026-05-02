# Story Point Calculator

Azure DevOps work item extension for structured Story Point estimation.

**Status:** In development. Marketplace listing assets and full README produced in Phase 5.

## Development

```bash
npm ci
npm run typecheck
npm test
npm run build:dev
```

## Dev Publish

To iterate on the extension against the dev ADO org `cezari`:

1. **One-time setup:** create `.env.local` at repo root with `TFX_PAT=<your Marketplace PAT>`. Generate a PAT at <https://marketplace.visualstudio.com/manage/publishers/tsezarimshvenieradzeextensions> with **Marketplace (Manage)** scope. The file is gitignored (see `.gitignore`); never commit it.
2. **Each iteration:**
   - `npm run build` — produces `dist/toolbar.{html,js}` and `dist/modal.{html,js}`
   - `npm run dev:publish` — bumps the patch version, packages the `.vsix`, publishes to the cezari org with `--share-with cezari`, then restores `vss-extension.json` from snapshot so git stays clean
   - Refresh the work item form in <https://dev.azure.com/cezari> to pick up the new version (~30 seconds end-to-end)

The published version increases each iteration on the Marketplace side, but `vss-extension.json` in the repo is unchanged after each publish. Phase 5 introduces a real CI versioning strategy.

### Manual fallback

If `npm run dev:publish` fails, run the underlying tfx commands directly:

- `npx tfx extension publish --manifest-globs vss-extension.json --share-with cezari --rev-version --token <PAT>`
- `npx tfx extension share --share-with cezari --publisher TsezariMshvenieradzeExtensions --extension-id story-point-calculator` (only if the share didn't take)

Reverting an unintended manifest mutation: `git checkout vss-extension.json`.
