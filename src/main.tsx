import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AccessGate } from "./AccessGate";
import { ScreenBoundary } from "./ScreenBoundary";
import "./style.css";
import "./security.css";
import "./mobile.css";
import "./forms.css";
import "./navigation.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ScreenBoundary>
      <AccessGate>
        <App />
      </AccessGate>
    </ScreenBoundary>
  </React.StrictMode>,
);
