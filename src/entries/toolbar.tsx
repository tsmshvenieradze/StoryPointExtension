// src/entries/toolbar.tsx — Phase 0 stub; Phase 2 implements SDK lifecycle and openCustomDialog
// Why this exists in Phase 0: webpack must have entry files to resolve. Without them, build fails.
// What's intentionally missing: SDK.init, SDK.ready, register, notifyLoadSucceeded — all Phase 2.

export {};   // placate `isolatedModules: true`; file is a module with no exports
console.log('toolbar entry loaded — Phase 2 will register the action handler here');
