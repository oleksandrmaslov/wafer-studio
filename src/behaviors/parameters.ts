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
      const [page, id] = hid_usage_page_and_id_from_usage(value);
      return page !== 0 && id !== 0;
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
