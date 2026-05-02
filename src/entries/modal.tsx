// src/entries/modal.tsx — Phase 3 implementation
// Source: https://github.com/microsoft/azure-devops-extension-sample/blob/master/src/Samples/panel-content/panel-content.tsx
// Modernized: React 18 createRoot; loaded:false discipline per D-12.
//
// Lifecycle: SDK.init({loaded:false}) → await SDK.ready() → read config → render →
//   SDK.notifyLoadSucceeded(). Skipping notifyLoadSucceeded leaves a permanent
//   spinner (RESEARCH §Pitfall 3). applyTheme:true is the SDK default; the host's
//   theme CSS variables flow into our iframe automatically and azure-devops-ui
//   Surface+Page consume them — no theme-detection code (D-13, RESEARCH §Pitfall 4).
//
// Phase 3: replace Phase 2's <Hello> with the full <CalcModal> — same workItemId
//   prop contract, same SDK lifecycle bootstrap. The actual calculator UI,
//   read path, and stub Apply live in src/ui/CalcModal.tsx.

import * as React from "react";
import { createRoot } from "react-dom/client";
import * as SDK from "azure-devops-extension-sdk";
import { Surface, SurfaceBackground } from "azure-devops-ui/Surface";
import { Page as PageRaw } from "azure-devops-ui/Page";
import { Header, TitleSize } from "azure-devops-ui/Header";

// Upstream azure-devops-ui's Page IPageProps does not declare a `children`
// prop, even though Page is a React.Component<IPageProps> that renders its
// children in a column-based flexbox. Under React 18 strict typings + our
// strict tsconfig, JSX.IntrinsicAttributes refuses children unless declared.
// Microsoft's own sample uses <Page>...</Page>; the runtime works, only
// types are stale. Wrap Page to add `children` to its props. This is a
// type-only narrowing — no runtime behavior change.
const Page = PageRaw as unknown as React.FC<
  React.ComponentProps<typeof PageRaw> & { children?: React.ReactNode }
>;

// azure-devops-ui ships base layout/typography in a separate CSS file that
// must be imported once per iframe. Without it, Surface/Page render with
// theme variables but no chrome (RESEARCH §Pitfall 4).
import "azure-devops-ui/Core/override.css";

import type { CalcSpModalConfig } from "../ado/types";
import { CalcModal } from "../ui/CalcModal";

const LOG_PREFIX = "[sp-calc/modal]";

const ConfigError: React.FC<{ received: unknown }> = ({ received }) => (
  <Surface background={SurfaceBackground.neutral}>
    <Page className="flex-grow">
      <Header title="Story Point Calculator — Configuration Error" titleSize={TitleSize.Large} />
      <div className="page-content page-content-top">
        <p>The dialog opened without a valid <code>workItemId</code> configuration. This is a plumbing bug between the toolbar action and the modal contribution.</p>
        <p style={{ fontSize: "12px", opacity: 0.7, marginTop: "16px" }}>
          Received configuration: <code>{JSON.stringify(received) ?? "undefined"}</code>
        </p>
      </div>
    </Page>
  </Surface>
);

async function bootstrap() {
  // Lifecycle: init → ready → read config → render → notifyLoadSucceeded.
  // applyTheme:true is the SDK default — host theme CSS variables flow
  // into our iframe automatically; azure-devops-ui consumes them via CSS,
  // no detection code needed (D-13).
  await SDK.init({ loaded: false });
  console.log(`${LOG_PREFIX} init() resolved`);
  await SDK.ready();
  console.log(`${LOG_PREFIX} ready() resolved`);

  const config = SDK.getConfiguration() as CalcSpModalConfig | undefined;
  console.log(`${LOG_PREFIX} SDK ready`, { config });

  const rootEl = document.getElementById("root");
  if (!rootEl) {
    throw new Error("#root element missing from modal.html — see RESEARCH §Pitfall 12");
  }

  const root = createRoot(rootEl);

  // Fail loud, not silent: rendering a placeholder for missing config
  // masks plumbing bugs in the toolbar→modal handoff. Surface a
  // configuration-error UI instead so failures are immediately visible
  // during development.
  if (typeof config?.workItemId !== "number") {
    console.error(`${LOG_PREFIX} workItemId missing from configuration`, config);
    root.render(<ConfigError received={config} />);
  } else {
    // Phase 3 swap: the Hello echo becomes the full calculator UI.
    // CalcModal owns the read path (FieldResolver, getFieldValue,
    // getCommentsModern, parseLatest pre-fill) and the stub Apply.
    root.render(<CalcModal workItemId={config.workItemId} />);
  }

  // Tell the host to remove its loading spinner. Without this call the
  // host shows a permanent spinner over the dialog content (RESEARCH §Pitfall 3).
  await SDK.notifyLoadSucceeded();
  console.log(`${LOG_PREFIX} notifyLoadSucceeded called`);
}

bootstrap().catch((err) => {
  console.error(`${LOG_PREFIX} bootstrap failed`, err);
  // notifyLoadFailed surfaces a host-level error UI instead of a stuck spinner.
  SDK.notifyLoadFailed(err instanceof Error ? err : String(err));
});
