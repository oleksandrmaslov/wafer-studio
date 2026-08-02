import { useEffect, useMemo, useState } from "react";

import { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import { BehaviorBinding } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { BehaviorParametersPicker } from "./BehaviorParametersPicker";
import { validateBindingParameters } from "./parameters";

export interface BehaviorBindingPickerProps {
  binding: BehaviorBinding;
  behaviors: GetBehaviorDetailsResponse[];
  layers: { id: number; name: string }[];
  onBindingChanged: (binding: BehaviorBinding) => void;
}

export const BehaviorBindingPicker = ({
  binding,
  layers,
  behaviors,
  onBindingChanged,
}: BehaviorBindingPickerProps) => {
  const [behaviorId, setBehaviorId] = useState(binding.behaviorId);
  const [param1, setParam1] = useState<number | undefined>(binding.param1);
  const [param2, setParam2] = useState<number | undefined>(binding.param2);

  const metadata = useMemo(
    () => behaviors.find((b) => b.id == behaviorId)?.metadata,
    [behaviorId, behaviors],
  );

  const sortedBehaviors = useMemo(
    () =>
      [...behaviors].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [behaviors],
  );

  const selectedBehavior = useMemo(
    () => behaviors.find((behavior) => behavior.id === behaviorId),
    [behaviorId, behaviors],
  );

  useEffect(() => {
    if (
      binding.behaviorId === behaviorId &&
      binding.param1 === param1 &&
      binding.param2 === param2
    ) {
      return;
    }

    if (!metadata) {
      console.error(
        "Can't find metadata for the selected behaviorId",
        behaviorId,
      );
      return;
    }

    if (
      validateBindingParameters(
        metadata,
        layers.map(({ id }) => id),
        param1,
        param2,
      )
    ) {
      onBindingChanged({
        behaviorId,
        param1: param1 || 0,
        param2: param2 || 0,
      });
    }
  }, [
    behaviorId,
    binding.behaviorId,
    binding.param1,
    binding.param2,
    layers,
    metadata,
    onBindingChanged,
    param1,
    param2,
  ]);

  useEffect(() => {
    setBehaviorId(binding.behaviorId);
    setParam1(binding.param1);
    setParam2(binding.param2);
  }, [binding]);

  return (
    <section aria-labelledby="binding-action-heading" className="grid gap-4">
      <div>
        <p
          id="binding-action-heading"
          className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-base-content/50"
        >
          Key action
        </p>
        <p className="mt-1 text-sm text-base-content/65">
          Choose from the behaviors reported by this keyboard.
        </p>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="behavior-picker" className="text-sm font-semibold">
          Behavior
        </label>
        <select
          id="behavior-picker"
          value={behaviorId}
          className="min-h-11 w-full rounded-lg border border-line bg-raised px-3 text-sm text-base-content outline-none transition hover:border-base-content/30 focus-visible:ring-2 focus-visible:ring-focus"
          onChange={(e) => {
            setBehaviorId(parseInt(e.target.value));
            setParam1(0);
            setParam2(0);
          }}
        >
          {sortedBehaviors.map((b) => (
            <option key={b.id} value={b.id}>
              {b.displayName}
            </option>
          ))}
        </select>
        <p className="font-mono text-[0.6875rem] text-base-content/45">
          Runtime behavior {selectedBehavior?.id ?? behaviorId}
        </p>
      </div>

      {metadata && (
        <div className="grid gap-3 border-t border-line pt-4">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-base-content/50">
            Parameters
          </p>
          <BehaviorParametersPicker
            metadata={metadata}
            param1={param1}
            param2={param2}
            layers={layers}
            onParam1Changed={setParam1}
            onParam2Changed={setParam2}
          />
        </div>
      )}
    </section>
  );
};
