// Copyright 2026 Oleksandr Maslov
// SPDX-License-Identifier: Apache-2.0

import React from "react";
import ReactDOM from "react-dom/client";
import { DesignSystemPage } from "./design-system/DesignSystemPage.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DesignSystemPage />
  </React.StrictMode>
);
