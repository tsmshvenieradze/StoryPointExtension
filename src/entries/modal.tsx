// src/entries/modal.tsx — Phase 2 implementation
// Source: https://github.com/microsoft/azure-devops-extension-sample/blob/master/src/Samples/panel-content/panel-content.tsx
// Modernized: React 18 createRoot; loaded:false discipline per D-12.
//
// Lifecycle: SDK.init({loaded:false}) → await SDK.ready() → read config → render →
//   SDK.notifyLoadSucceeded(). Skipping notifyLoadSucceeded leaves a permanent
//   spinner (RESEARCH §Pitfall 3). applyTheme:true is the SDK default; the host's
//   theme CSS variables flow into our iframe automatically and azure-devops-ui
//   Surface+Page consume them — no theme-detection code (D-13, RESEARCH §Pitfall 4).
//
// Phase 2 boundary: workItemId echo only. NO field reads (D-21, D-22),
// NO writes (D-23), NO imports of src/calc/ or src/audit/ (D-24).

import * as React from "react";
import { createRoot } from "react-dom/client";
import * as SDK from "azure-devops-extension-sdk";
import { Surface, SurfaceBackground } from "azure-devops-ui/Surface";
import { Page as PageRaw } from "azure-devops-ui/Page";
import { Header, TitleSize } from "azure-devops-ui/Header";
import { Button } from "azure-devops-ui/Button";
import { ButtonGroup } from "azure-devops-ui/ButtonGroup";

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

const LOG_PREFIX = "[sp-calc/modal]";

interface HelloProps {
  workItemId: number;
}

const Hello: React.FC<HelloProps> = ({ workItemId }) => {
  return (
    <Surface background={SurfaceBackground.neutral}>
      <Page className="flex-grow">
        <Header
          title="Story Point Calculator"
          titleSize={TitleSize.Large}
        />
        <div className="page-content page-content-top">
          <p>Hello from Work Item #{workItemId}</p>
        </div>
        <div className="page-content page-content-bottom">
          <ButtonGroup>
            <Button
              text="Close"
              primary={true}
              onClick={() => {
                // Phase 2 (D-06): decorative Close — host's X button and
                // lightDismiss:true are the canonical close paths.
                // Phase 3 may wire programmatic close if needed.
                console.log(`${LOG_PREFIX} Close clicked (host X is canonical)`);
              }}
            />
          </ButtonGroup>
        </div>
      </Page>
    </Surface>
  );
};

async function bootstrap() {
  // Lifecycle: init → ready → read config → render → notifyLoadSucceeded.
  // applyTheme:true is the SDK default — host theme CSS variables flow
  // into our iframe automatically; azure-devops-ui consumes them via CSS,
  // no detection code needed (D-13).
  await SDK.init({ loaded: false });
  console.log(`${LOG_PREFIX} init() resolved`);
  await SDK.ready();
  console.log(`${LOG_PREFIX} ready() resolved`);

  const config = SDK.getConfiguration() as CalcSpModalConfig;
  console.log(`${LOG_PREFIX} SDK ready`, { config });

  // Defensive: if configuration is missing (shouldn't happen in normal flow,
  // but openCustomDialog without options would yield undefined), default to 0
  // and log loudly so debugging doesn't waste time.
  const workItemId = typeof config?.workItemId === "number" ? config.workItemId : 0;
  if (workItemId === 0) {
    console.error(`${LOG_PREFIX} workItemId missing from configuration`, config);
  }

  const rootEl = document.getElementById("root");
  if (!rootEl) {
    throw new Error("#root element missing from modal.html — see RESEARCH §Pitfall 12");
  }

  const root = createRoot(rootEl);
  root.render(<Hello workItemId={workItemId} />);

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
