import React from "react";
import ReactDOM from "react-dom/client";
import { DesignSystemPage } from "./design-system/DesignSystemPage.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DesignSystemPage />
  </React.StrictMode>
);
