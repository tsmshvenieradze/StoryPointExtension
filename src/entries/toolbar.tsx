// src/entries/toolbar.tsx — Phase 2 implementation
// SDK lifecycle ordering matters — see RESEARCH §Pitfall 7 (init race) and PITFALLS.md Pitfall 6 (SDK silent failure patterns).
// Source: https://github.com/microsoft/azure-devops-extension-sample/blob/master/src/Samples/work-item-toolbar-menu/work-item-toolbar-menu.ts
//
// Lifecycle (D-12): SDK.register(...) at module top → SDK.init({loaded:false}) → await SDK.ready() → notifyLoadSucceeded().
// Register BEFORE init so the registration is queued and flushed during the host handshake.
// No imports from src/calc/ or src/audit/ (D-24).

import * as SDK from "azure-devops-extension-sdk";
import type { CalcSpModalConfig } from "../ado/types";

const LOG_PREFIX = "[sp-calc/toolbar]";

// Plan 260504-cl1 v1.0.5 reversal: use IGlobalMessagesService.addDialog
// instead of IHostPageLayoutService.openCustomDialog.
//
// v1.0.4 cezari evidence (2026-05-04 console transcript): every wired close
// surface (Cancel button, post-Saved 600ms timer, Esc keydown) successfully
// invoked SDK.getService("ms.vss-tfs-web.tfs-global-messages-service")
// .closeDialog() with no throw — and the modal stayed open. Conclusion:
// closeDialog() only manages the dialog stack created by addDialog(); it
// is a silent no-op for openCustomDialog instances. Phase 4 D-10
// NO-PROGRAMMATIC-CLOSE was correct on the openCustomDialog code path.
//
// To make programmatic close actually work, swap the OPEN side too:
// addDialog → managed by closeDialog → all three close surfaces become live.
// Trade: addDialog renders through the host's CornerDialog/CustomDialog
// renderer rather than the external-content dialog renderer; visual chrome
// may differ (centering, sizing). Worst case = v1.0.6 revert.
const GLOBAL_MESSAGES_SERVICE_ID = "ms.vss-tfs-web.tfs-global-messages-service";

// Local interface — IGlobalMessagesService comes from a const-enum-bearing
// module that our isolatedModules tsconfig can't import at runtime. Mirror
// the bridge.ts pattern (only the methods we call). Verified at
// node_modules/azure-devops-extension-api/Common/CommonServices.d.ts:652.
interface IGlobalDialog {
  contributionId?: string;
  contributionConfiguration?: object;
  title?: string;
  onDismiss?: () => void;
}
interface IGlobalMessagesService {
  addDialog: (dialog: IGlobalDialog) => void;
  closeDialog: () => void;
}

// The registered object id MUST match vss-extension.json
// contributions[id=calc-sp-action].properties.registeredObjectId.
// Mismatch = silent failure: host fires no callback (RESEARCH §Pitfall 1).
const REGISTERED_ID = "calc-sp-action";

// Composing the modal contribution id at runtime via SDK.getExtensionContext()
// keeps publisher and extension id in one place (the manifest), so renames
// can't silently break the dialog open. The full id form is required by
// openCustomDialog (RESEARCH §Pitfall 2).
const MODAL_CONTRIB_SHORT_ID = "calc-sp-modal";

// Register at module top — BEFORE SDK.init(). The SDK queues registrations
// until init completes; swapping the order produces race conditions
// (RESEARCH §Pitfall 7, verified in Microsoft canonical sample).
SDK.register(REGISTERED_ID, () => {
  return {
    // Host calls execute(actionContext) when the user clicks the toolbar entry.
    // actionContext shape for ms.vss-work-web.work-item-toolbar-menu is
    // documented as `any` in Microsoft samples — observed fields include
    // workItemId, id (alias for workItemId on some surfaces), and
    // workItemTypeName. Treat the parameter as a permissive shape and
    // extract a numeric work item id from either field. Multi-select
    // surfaces pass an array — defend against that too (RESEARCH §Pitfall 8).
    // Never cache the workItemId in module scope — the toolbar iframe is
    // reused across Next/Previous navigations (RESEARCH §Pitfall 9).
    execute: async (actionContext: any) => {
      const ctx = Array.isArray(actionContext) ? actionContext[0] : actionContext;
      const workItemId =
        (typeof ctx?.workItemId === "number" ? ctx.workItemId : undefined) ??
        (typeof ctx?.id === "number" ? ctx.id : undefined);

      console.log(`${LOG_PREFIX} execute fired`, {
        actionContext,
        resolvedWorkItemId: workItemId,
      });

      if (typeof workItemId !== "number") {
        console.error(`${LOG_PREFIX} no work item id in actionContext`, actionContext);
        return;
      }

      const messagesSvc = await SDK.getService<IGlobalMessagesService>(
        GLOBAL_MESSAGES_SERVICE_ID
      );

      const config: CalcSpModalConfig = { workItemId };
      const fullModalId = `${SDK.getExtensionContext().id}.${MODAL_CONTRIB_SHORT_ID}`;

      console.log(`${LOG_PREFIX} opening dialog (addDialog)`, { fullModalId, config });

      // addDialog returns void; the dialog enters the global dialog stack and
      // becomes the target of the matching closeDialog() call (used by the
      // bridge.ts closeProgrammatically helper that Cancel / post-Saved /
      // Esc all route to). contributionConfiguration is the addDialog
      // analogue of openCustomDialog's `configuration` — same XDM channel
      // proxy, same JSON-safe payload requirement (D-11).
      //
      // onDismiss replaces openCustomDialog's onClose; the host invokes it
      // when the dialog leaves the stack (via X click, outside-click, or
      // our closeDialog() call). No TResult parameter — addDialog does not
      // surface a result object back to the toolbar.
      messagesSvc.addDialog({
        contributionId: fullModalId,
        contributionConfiguration: config,
        title: "Calculate Story Points",
        onDismiss: () => {
          console.log(`${LOG_PREFIX} dialog dismissed`);
        },
      });
    },
  };
});

// Initialize AFTER register so the registration is in place when the host
// completes the handshake. loaded:false matches D-12 — we explicitly
// notifyLoadSucceeded after register to tell the host the toolbar iframe
// is ready. applyTheme:true is the SDK default and is left implicit.
async function bootstrap() {
  await SDK.init({ loaded: false });
  console.log(`${LOG_PREFIX} init() resolved`);
  await SDK.ready();
  console.log(`${LOG_PREFIX} ready() resolved`);
  await SDK.notifyLoadSucceeded();
  console.log(`${LOG_PREFIX} notifyLoadSucceeded called`);
}

bootstrap().catch((err) => {
  console.error(`${LOG_PREFIX} bootstrap failed`, err);
  SDK.notifyLoadFailed(err instanceof Error ? err : String(err));
});
