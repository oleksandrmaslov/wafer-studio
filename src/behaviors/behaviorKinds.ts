// Copyright 2026 Oleksandr Maslov
// SPDX-License-Identifier: Apache-2.0

import type {
  BehaviorParameterValueDescription,
  GetBehaviorDetailsResponse,
} from "@zmkfirmware/zmk-studio-ts-client/behaviors";

/**
 * Recognising what a behavior *is* from what the firmware reported.
 *
 * ZMK does not tell Studio which behavior is "the" key press or which ones are
 * hold/tap pairs — it reports a display name and a parameter shape, and the
 * client has to infer the rest. These predicates are that inference, kept in
 * one place because more than one part of the app now depends on the same
 * answer: the picker groups by it, and type-through needs the key-press
 * behavior's id before it can bind anything at all.
 */

export function normalizeName(name: string): string {
  return name
    .toLocaleLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isEmptyParameter(values: BehaviorParameterValueDescription[]) {
  return (
    values.length === 0 || values.every((value) => value.nil !== undefined)
  );
}

/**
 * The plain "press this key" behavior: one HID usage in param1, nothing in
 * param2. The shape check matters as much as the name — a firmware can expose
 * something else called "key press", and binding a usage into a behavior that
 * does not take one would produce a key that does nothing.
 */
export function isCanonicalKeyPress(
  behavior: GetBehaviorDetailsResponse,
): boolean {
  return (
    normalizeName(behavior.displayName) === "key press" &&
    behavior.metadata.some(
      ({ param1, param2 }) =>
        param1.some((value) => value.hidUsage !== undefined) &&
        isEmptyParameter(param2),
    )
  );
}

/** Hold/tap behaviors, which take a meaningful value in *both* parameters. */
export function isMultiBehavior(behavior: GetBehaviorDetailsResponse): boolean {
  const name = normalizeName(behavior.displayName);
  if (!["mod tap", "layer tap", "hold tap"].includes(name)) return false;

  return behavior.metadata.some(
    ({ param1, param2 }) =>
      param1.some(
        (value) => value.hidUsage !== undefined || value.layerId !== undefined,
      ) &&
      param2.some(
        (value) => value.hidUsage !== undefined || value.layerId !== undefined,
      ),
  );
}
