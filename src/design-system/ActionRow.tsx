// Copyright 2026 Oleksandr Maslov
// SPDX-License-Identifier: Apache-2.0

import type { LucideIcon } from "lucide-react";

export interface ActionRowProps {
  icon: LucideIcon;
  title: string;
  description: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export function ActionRow({
  icon: Icon,
  title,
  description,
  selected = false,
  disabled = false,
  onPress,
}: ActionRowProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      data-selected={selected}
      disabled={disabled}
      onClick={onPress}
      className="wafer-action-row"
    >
      <span className="wafer-action-row__icon">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-tight">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-[0.6875rem] leading-snug text-muted">
          {description}
        </span>
      </span>
    </button>
  );
}
