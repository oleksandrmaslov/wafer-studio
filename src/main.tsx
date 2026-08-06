// Modified by Oleksandr Maslov for Wafer Studio, 2026.
// Based on ZMK Studio, licensed under Apache-2.0.
// SPDX-License-Identifier: Apache-2.0

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { DispersionField } from "./design-system/DispersionField.tsx";
import "./index.css";

// The light is mounted at the root so the whole product shares one source. Any
// `.wafer-dispersive` edge anywhere in the tree samples the same field.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DispersionField>
      <App />
    </DispersionField>
  </React.StrictMode>
);
