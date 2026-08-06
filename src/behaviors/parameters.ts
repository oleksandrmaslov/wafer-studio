// Modified by Oleksandr Maslov for Wafer Studio, 2026.
// Based on ZMK Studio, licensed under Apache-2.0.
// SPDX-License-Identifier: Apache-2.0

import {
  BehaviorBindingParametersSet,
  BehaviorParameterValueDescription,
} from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import { hid_usage_page_and_id_from_usage } from "../hid-usages";

export function validateValue(
  layerIds: number[],
  value?: number,
  values?: BehaviorParameterValueDescription[],
): boolean {
  if (value === undefined) {
    return values === undefined || values?.length === 0 || !!values[0].nil;
  }

  const matchingValue = values?.find((v) => {
    if (v.constant !== undefined) {
      return v.constant == value;
    } else if (v.range) {
      return value >= v.range.min && value <= v.range.max;
    } else if (v.hidUsage) {
      // The high byte contains implicit modifier flags. The HID usage page
      // and usage ID live in the lower 24 bits.
      const [page, id] = hid_usage_page_and_id_from_usage(value & 0x00ffffff);

      if (page === 7) {
        return id >= 4 && id <= v.hidUsage.keyboardMax;
      }

      if (page === 12) {
        return id > 0 && id <= v.hidUsage.consumerMax;
      }

      return false;
    } else if (v.layerId) {
      return layerIds.includes(value);
    } else if (v.nil) {
      return value === 0;
    } else {
      console.error("Unknown check type!");
      return false;
    }
  });

  return !!matchingValue || (value === 0 && (!values || values.length === 0));
}

export function validateBindingParameters(
  metadata: BehaviorBindingParametersSet[],
  layerIds: number[],
  param1?: number,
  param2?: number,
): boolean {
  if (
    (param1 === undefined || param1 === 0) &&
    metadata.every((set) => !set.param1 || set.param1.length === 0)
  ) {
    return true;
  }

  const matchingSet = metadata.find((set) =>
    validateValue(layerIds, param1, set.param1),
  );

  return matchingSet
    ? validateValue(layerIds, param2, matchingSet.param2)
    : false;
}
