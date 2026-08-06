// Copyright 2026 Oleksandr Maslov
// SPDX-License-Identifier: Apache-2.0

export type LayoutZoom = number | "auto";

export function deserializeLayoutZoom(value: string): LayoutZoom {
  if (value === "auto") {
    return "auto";
  }
  return parseFloat(value) || "auto";
}
