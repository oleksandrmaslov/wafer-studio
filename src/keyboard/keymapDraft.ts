import type {
  BehaviorBinding,
  Keymap,
} from "@zmkfirmware/zmk-studio-ts-client/keymap";

export interface BindingLocation {
  layerId: number;
  keyPosition: number;
}

export interface DraftBindingChange extends BindingLocation {
  layerIndex: number;
  layerName: string;
  before: BehaviorBinding;
  after: BehaviorBinding;
}

export type DraftBindingOverrides = Readonly<Record<string, BehaviorBinding>>;

export interface DraftValidationResult {
  changes: DraftBindingChange[];
  errors: string[];
}

export interface DraftChangeSummary extends DraftBindingChange {
  beforeLabel: string;
  afterLabel: string;
}

export type DraftApplyResult =
  | {
      ok: true;
      appliedCount: number;
      deviceUnsaved: boolean;
    }
  | {
      ok: false;
      appliedCount: number;
      remainingCount: number;
      message: string;
      conflict?: boolean;
    };

export interface KeymapDraftController {
  draftCount: number;
  changes: DraftChangeSummary[];
  errors: string[];
  isApplying: boolean;
  apply: () => Promise<DraftApplyResult>;
  discard: () => void;
}

function locationKey({ layerId, keyPosition }: BindingLocation): string {
  return `${layerId}:${keyPosition}`;
}

function parseLocationKey(key: string): BindingLocation | undefined {
  const [layerId, keyPosition, ...rest] = key.split(":").map(Number);
  if (
    rest.length > 0 ||
    !Number.isInteger(layerId) ||
    !Number.isInteger(keyPosition)
  ) {
    return undefined;
  }

  return { layerId, keyPosition };
}

export function bindingEquals(
  left: BehaviorBinding | undefined,
  right: BehaviorBinding | undefined,
): boolean {
  return (
    left?.behaviorId === right?.behaviorId &&
    left?.param1 === right?.param1 &&
    left?.param2 === right?.param2
  );
}

export function updateDraftBinding(
  deviceKeymap: Keymap,
  draft: DraftBindingOverrides,
  location: BindingLocation,
  binding: BehaviorBinding,
): DraftBindingOverrides {
  const next = { ...draft };
  const layer = deviceKeymap.layers.find(({ id }) => id === location.layerId);
  const deviceBinding = layer?.bindings[location.keyPosition];

  if (bindingEquals(deviceBinding, binding)) {
    delete next[locationKey(location)];
  } else {
    next[locationKey(location)] = binding;
  }

  return next;
}

export function getDraftBinding(
  draft: DraftBindingOverrides,
  location: BindingLocation,
): BehaviorBinding | undefined {
  return draft[locationKey(location)];
}

export function materializeDraftKeymap(
  deviceKeymap: Keymap,
  draft: DraftBindingOverrides,
): Keymap {
  return {
    ...deviceKeymap,
    layers: deviceKeymap.layers.map((layer) => ({
      ...layer,
      bindings: layer.bindings.map(
        (binding, keyPosition) =>
          getDraftBinding(draft, { layerId: layer.id, keyPosition }) ?? binding,
      ),
    })),
  };
}

export function planDraftBindings(
  deviceKeymap: Keymap,
  draft: DraftBindingOverrides,
  knownBehaviorIds: ReadonlySet<number>,
): DraftValidationResult {
  const changes: DraftBindingChange[] = [];
  const errors: string[] = [];

  for (const [key, after] of Object.entries(draft)) {
    const location = parseLocationKey(key);
    if (!location) {
      errors.push(`Draft location ${key} is invalid.`);
      continue;
    }

    const layerIndex = deviceKeymap.layers.findIndex(
      ({ id }) => id === location.layerId,
    );
    if (layerIndex < 0) {
      errors.push(`Layer ${location.layerId} is no longer available.`);
      continue;
    }

    const layer = deviceKeymap.layers[layerIndex];
    const before = layer.bindings[location.keyPosition];
    if (!before) {
      errors.push(
        `${layer.name || `Layer ${layerIndex}`} has no key at position ${location.keyPosition}.`,
      );
      continue;
    }

    if (!knownBehaviorIds.has(after.behaviorId)) {
      errors.push(
        `Behavior ${after.behaviorId} is not available on this keyboard.`,
      );
    }

    if (!bindingEquals(before, after)) {
      changes.push({
        ...location,
        layerIndex,
        layerName: layer.name || `Layer ${layerIndex}`,
        before,
        after,
      });
    }
  }

  changes.sort(
    (left, right) =>
      left.layerIndex - right.layerIndex ||
      left.layerId - right.layerId ||
      left.keyPosition - right.keyPosition,
  );

  return { changes, errors };
}

/**
 * Drops only intents that the latest device snapshot already contains. Missing
 * locations remain in the draft so reconnect/conflict recovery never loses work.
 */
export function rebaseDraftBindings(
  deviceKeymap: Keymap,
  draft: DraftBindingOverrides,
): DraftBindingOverrides {
  let next: DraftBindingOverrides = draft;

  for (const [key, binding] of Object.entries(draft)) {
    const location = parseLocationKey(key);
    if (!location) continue;

    const layer = deviceKeymap.layers.find(({ id }) => id === location.layerId);
    if (!bindingEquals(layer?.bindings[location.keyPosition], binding))
      continue;

    if (next === draft) next = { ...draft };
    delete (next as Record<string, BehaviorBinding>)[key];
  }

  return next;
}

export function countDraftBindings(draft: DraftBindingOverrides): number {
  return Object.keys(draft).length;
}
