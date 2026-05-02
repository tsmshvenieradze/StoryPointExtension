// src/entries/toolbar.tsx — Phase 2 implementation
// SDK lifecycle ordering matters — see RESEARCH §Pitfall 7 (init race) and PITFALLS.md Pitfall 6 (SDK silent failure patterns).
// Source: https://github.com/microsoft/azure-devops-extension-sample/blob/master/src/Samples/work-item-toolbar-menu/work-item-toolbar-menu.ts
//
// Lifecycle (D-12): SDK.register(...) at module top → SDK.init({loaded:false}) → await SDK.ready() → notifyLoadSucceeded().
// Register BEFORE init so the registration is queued and flushed during the host handshake.
// No imports from src/calc/ or src/audit/ (D-24).

import * as SDK from "azure-devops-extension-sdk";
import type { IHostPageLayoutService } from "azure-devops-extension-api";
import type { CalcSpModalConfig } from "../ado/types";

const LOG_PREFIX = "[sp-calc/toolbar]";

// CommonServiceIds is declared as a `const enum` upstream; with our
// `isolatedModules: true` tsconfig we cannot access const-enum members at
// runtime. Use the string literal directly — value verified in
// node_modules/azure-devops-extension-api/Common/CommonServices.d.ts and
// in RESEARCH §interfaces (CommonServiceIds.HostPageLayoutService).
const HOST_PAGE_LAYOUT_SERVICE_ID = "ms.vss-features.host-page-layout-service";

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

      const layoutSvc = await SDK.getService<IHostPageLayoutService>(
        HOST_PAGE_LAYOUT_SERVICE_ID
      );

      const config: CalcSpModalConfig = { workItemId };
      const fullModalId = `${SDK.getExtensionContext().id}.${MODAL_CONTRIB_SHORT_ID}`;

      console.log(`${LOG_PREFIX} opening dialog`, { fullModalId, config });

      // openCustomDialog returns void (verified type signature).
      // The dialog has a host-managed close button (X) plus lightDismiss:true
      // default. onClose fires when the host closes the dialog.
      layoutSvc.openCustomDialog<undefined>(fullModalId, {
        title: "Calculate Story Points",
        configuration: config,
        lightDismiss: true,
        onClose: () => {
          console.log(`${LOG_PREFIX} dialog closed`);
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
