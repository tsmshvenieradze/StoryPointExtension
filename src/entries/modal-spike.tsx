// src/entries/modal-spike.tsx — TEMPORARY spike build for Plan 04-01.
//
// SPIKE — DELETE IN PLAN 04-01 TASK 4.
//
// Purpose: empirically resolve four [ASSUMED] decisions flagged in 04-RESEARCH.md
// before any Phase 4 implementation file is written. Each probe button below
// runs one of the four spike probes against the live cezari work item the
// modal was opened on. Outputs go to the DevTools console with the
// "[sp-calc/spike]" prefix; the user copies transcripts into 04-VERIFICATION.md.
//
// Lifecycle mirrors src/entries/modal.tsx (Phase 3 Override 5 — explicit
// SDK.resize, ResizeObserver, notifyLoadSucceeded). Inline buttons instead
// of azure-devops-ui to keep the spike build minimal.
//
// IMPORTANT (T-04-01-01): NEVER console.log a token value directly. Use
// `token?.length ?? 0` style logging only — same pattern as comments.ts:61.

import * as React from "react";
import { createRoot } from "react-dom/client";
import * as SDK from "azure-devops-extension-sdk";

const LOG_PREFIX = "[sp-calc/spike]";

// ---------- Probe 1: format:1 sentinel preservation ----------
// Tests both api-versions (7.0-preview.3 / 7.1-preview.4) cross
// {format:1, no-format} for D-01/D-02/D-13 sentinel resolution.
async function probe1(): Promise<void> {
  console.log(`[sp-calc/spike] probe1 START`);
  const host = SDK.getHost();
  console.log(`[sp-calc/spike] probe1 host`, { name: host.name, isHosted: host.isHosted });
  const token = await SDK.getAccessToken();
  console.log(`[sp-calc/spike] probe1 token acquired (len=${token?.length ?? 0})`);
  const baseUrl = host.isHosted
    ? `https://dev.azure.com/${host.name}`
    : `https://${host.name}.visualstudio.com`;
  const projectId = SDK.getWebContext().project.id;
  const wid = (SDK.getConfiguration() as { workItemId: number }).workItemId;
  console.log(`[sp-calc/spike] probe1 baseUrl=${baseUrl} projectId=${projectId} wid=${wid}`);
  const sentinel =
    `<!-- sp-calc:v1 {"sp":3,"c":"Easy","u":"Easy","e":"Easy","schemaVersion":1} -->\n` +
    `Story Points: 3 (Complexity=Easy, Uncertainty=Easy, Effort=Easy)`;
  const cases: Array<{ label: string; apiVersion: string; body: object }> = [
    { label: "7.0-preview.3 + format=1", apiVersion: "7.0-preview.3", body: { text: sentinel, format: 1 } },
    { label: "7.1-preview.4 + format=1", apiVersion: "7.1-preview.4", body: { text: sentinel, format: 1 } },
    { label: "7.0-preview.3 + NO format", apiVersion: "7.0-preview.3", body: { text: sentinel } },
    { label: "7.1-preview.4 + NO format", apiVersion: "7.1-preview.4", body: { text: sentinel } },
  ];
  for (const c of cases) {
    const url = `${baseUrl}/${encodeURIComponent(projectId)}/_apis/wit/workItems/${wid}/comments?api-version=${c.apiVersion}`;
    console.log(`[sp-calc/spike] probe1 POST ${c.label} url=${url}`);
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(c.body),
      });
      const respText = await resp.text();
      console.log(`[sp-calc/spike] probe1 ${c.label} status=${resp.status} ok=${resp.ok}`);
      console.log(`[sp-calc/spike] probe1 ${c.label} responseBody=`, respText);
    } catch (err) {
      console.log(`[sp-calc/spike] probe1 ${c.label} threw:`, (err as Error).message);
    }
  }
  console.log(`[sp-calc/spike] probe1 DONE — open the cezari Discussion view to inspect rendering of the four new comments`);
}

// ---------- Probe 2: isReadOnly mechanisms ----------
// Tests four candidate isReadOnly probes for D-05/D-07.
async function probe2(): Promise<void> {
  console.log(`[sp-calc/spike] probe2 START`);
  const formService = await SDK.getService<any>("ms.vss-work-web.work-item-form");
  console.log(`[sp-calc/spike] probe2 formService acquired`);

  console.log(`[sp-calc/spike] probe2 (a) calling formService.isReadOnly() if it exists...`);
  try {
    const result = await formService.isReadOnly?.();
    console.log(`[sp-calc/spike] probe2 (a) result type=`, typeof result, "value=", result);
  } catch (err) {
    console.log(`[sp-calc/spike] probe2 (a) threw:`, (err as Error).name, (err as Error).message);
  }

  console.log(`[sp-calc/spike] probe2 (b) getFieldValue('System.AuthorizedAs')...`);
  try {
    const v = await formService.getFieldValue("System.AuthorizedAs");
    console.log(`[sp-calc/spike] probe2 (b) type=`, typeof v, "value=", v);
  } catch (err) {
    console.log(`[sp-calc/spike] probe2 (b) threw:`, (err as Error).message);
  }

  console.log(`[sp-calc/spike] probe2 (c) self-setFieldValue probe...`);
  try {
    const cur = await formService.getFieldValue("Microsoft.VSTS.Scheduling.StoryPoints");
    console.log(`[sp-calc/spike] probe2 (c) current value type=`, typeof cur, "value=", cur);
    const ok = await formService.setFieldValue("Microsoft.VSTS.Scheduling.StoryPoints", cur);
    console.log(`[sp-calc/spike] probe2 (c) self-setFieldValue returned=`, ok);
    const isValid = await formService.isValid();
    const isDirty = await formService.isDirty();
    console.log(`[sp-calc/spike] probe2 (c) post-self-write isValid=`, isValid, "isDirty=", isDirty);
    await formService.reset();
    console.log(`[sp-calc/spike] probe2 (c) reset() called to undo dirty`);
  } catch (err) {
    console.log(`[sp-calc/spike] probe2 (c) threw:`, (err as Error).name, (err as Error).message);
  }

  console.log(`[sp-calc/spike] probe2 (d) SDK.getUser()...`);
  const user = SDK.getUser();
  console.log(`[sp-calc/spike] probe2 (d) user object=`, JSON.stringify(user, null, 2));

  console.log(`[sp-calc/spike] probe2 DONE`);
}

// ---------- Probe 3: programmatic dialog close attempts ----------
// Tests three speculative SDK close methods for D-10/Finding 3.
async function probe3(): Promise<void> {
  console.log(`[sp-calc/spike] probe3 START`);
  const tries: ReadonlyArray<readonly [string, () => unknown]> = [
    ["notifyDialogResult", () => (SDK as any).notifyDialogResult?.({ closed: true, sp: 3 })],
    ["notifyDismiss", () => (SDK as any).notifyDismiss?.()],
    ["closeCustomDialog", () => (SDK as any).closeCustomDialog?.()],
  ];
  for (const [name, fn] of tries) {
    try {
      const r = await fn();
      console.log(`[sp-calc/spike] probe3 ${name} returned=`, r, "modal still open? — visually inspect");
    } catch (err) {
      console.log(`[sp-calc/spike] probe3 ${name} threw:`, (err as Error).message);
    }
  }
  console.log(`[sp-calc/spike] probe3 DONE — verify visually that the modal is still open`);
}

// ---------- Probe 4: mid-write force-close behavior ----------
// 8-second deferred setFieldValue after a successful comment POST. User
// MUST click outside the dialog during the 8s window to trigger lightDismiss.
async function probe4(): Promise<void> {
  console.log(`[sp-calc/spike] probe4 START`);
  const host = SDK.getHost();
  const token = await SDK.getAccessToken();
  console.log(`[sp-calc/spike] probe4 token acquired (len=${token?.length ?? 0})`);
  const baseUrl = host.isHosted
    ? `https://dev.azure.com/${host.name}`
    : `https://${host.name}.visualstudio.com`;
  const projectId = SDK.getWebContext().project.id;
  const wid = (SDK.getConfiguration() as { workItemId: number }).workItemId;
  const sentinel =
    `<!-- sp-calc:v1 {"sp":1,"c":"Very Easy","u":"Very Easy","e":"Very Easy","schemaVersion":1} -->\n` +
    `Story Points: 1 (probe4 mid-write test)`;
  const url = `${baseUrl}/${encodeURIComponent(projectId)}/_apis/wit/workItems/${wid}/comments?api-version=7.0-preview.3`;
  console.log(`[sp-calc/spike] probe4 POSTING comment...`);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: sentinel, format: 1 }),
    });
    console.log(`[sp-calc/spike] probe4 comment status=`, resp.status);
  } catch (err) {
    console.log(`[sp-calc/spike] probe4 comment POST threw:`, (err as Error).message);
  }
  console.log(`[sp-calc/spike] probe4 deferring setFieldValue by 8000ms — CLICK OUTSIDE THE DIALOG NOW to test lightDismiss mid-write`);
  await new Promise((r) => setTimeout(r, 8000));
  console.log(`[sp-calc/spike] probe4 8s elapsed — attempting setFieldValue + save`);
  try {
    const formService = await SDK.getService<any>("ms.vss-work-web.work-item-form");
    const ok = await formService.setFieldValue("Microsoft.VSTS.Scheduling.StoryPoints", 1);
    console.log(`[sp-calc/spike] probe4 setFieldValue returned=`, ok);
    await formService.save();
    console.log(`[sp-calc/spike] probe4 save() resolved — field write completed even though dialog may have force-closed`);
  } catch (err) {
    console.log(`[sp-calc/spike] probe4 field write threw:`, (err as Error).message);
  }
  console.log(`[sp-calc/spike] probe4 DONE`);
}

// ---------- React UI: four probe buttons ----------
const SpikeButtons: React.FC = () => {
  const buttonStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    margin: "8px 0",
    padding: "12px 16px",
    fontSize: "14px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    cursor: "pointer",
    border: "1px solid #888",
    borderRadius: "4px",
    background: "#fff",
    textAlign: "left",
  };
  return (
    <div style={{ padding: "16px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h3 style={{ margin: "0 0 12px 0" }}>Spike Probes (Plan 04-01)</h3>
      <p style={{ fontSize: "12px", marginTop: 0, opacity: 0.8 }}>
        Open DevTools console BEFORE clicking. Each probe logs to console with prefix
        <code style={{ background: "#eee", padding: "1px 4px" }}>{LOG_PREFIX}</code>.
      </p>
      <button style={buttonStyle} onClick={() => { void probe1(); }}>
        Probe 1: format=1 vs no-format (sentinel preservation, D-01/D-02/D-13)
      </button>
      <button style={buttonStyle} onClick={() => { void probe2(); }}>
        Probe 2: isReadOnly mechanisms (D-05/D-07)
      </button>
      <button style={buttonStyle} onClick={() => { void probe3(); }}>
        Probe 3: programmatic dialog close (D-10/Finding 3)
      </button>
      <button style={buttonStyle} onClick={() => { void probe4(); }}>
        Probe 4: mid-write force-close (D-15) — CLICK OUTSIDE during 8s window
      </button>
    </div>
  );
};

// ---------- Bootstrap (mirrors src/entries/modal.tsx) ----------
async function bootstrap() {
  await SDK.init({ loaded: false });
  console.log(`[sp-calc/spike] init() resolved`);
  await SDK.ready();
  console.log(`[sp-calc/spike] ready() resolved`);

  const config = SDK.getConfiguration();
  console.log(`[sp-calc/spike] SDK ready`, { config });

  const rootEl = document.getElementById("root");
  if (!rootEl) {
    throw new Error("#root element missing from modal-spike.html");
  }

  const root = createRoot(rootEl);
  root.render(<SpikeButtons />);

  // Expose probes on window for console-driven invocation as a fallback.
  (window as any).spProbe1 = probe1;
  (window as any).spProbe2 = probe2;
  (window as any).spProbe3 = probe3;
  (window as any).spProbe4 = probe4;
  console.log(`[sp-calc/spike] probes exposed on window: spProbe1, spProbe2, spProbe3, spProbe4`);

  await SDK.notifyLoadSucceeded();
  console.log(`[sp-calc/spike] notifyLoadSucceeded called`);

  // Override 5: explicit SDK.resize lifecycle for ms.vss-web.external-content
  // dialogs — host does not auto-fit content.
  const requestResize = () =>
    SDK.resize(window.innerWidth, document.body.scrollHeight);
  requestResize();
  const resizeObserver = new ResizeObserver(requestResize);
  resizeObserver.observe(document.body);
}

bootstrap().catch((err) => {
  console.error(`[sp-calc/spike] bootstrap failed`, err);
  SDK.notifyLoadFailed(err instanceof Error ? err : String(err));
});
