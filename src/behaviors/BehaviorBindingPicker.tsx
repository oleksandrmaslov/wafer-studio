import { useEffect, useMemo, useState } from "react";

import type {
  BehaviorParameterValueDescription,
  GetBehaviorDetailsResponse,
} from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { BehaviorBinding } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import {
  AlertTriangle,
  Ban,
  Bluetooth,
  Cable,
  ChevronLeft,
  Eye,
  KeyboardIcon,
  Layers,
  Lightbulb,
  MousePointer2,
  Power,
  Repeat2,
  Search,
  Sparkles,
  ToggleLeft,
  type LucideIcon,
} from "lucide-react";

import { BehaviorParametersPicker } from "./BehaviorParametersPicker";
import {
  describeHidUsage,
  filterHidActionCatalogForUsagePages,
} from "./actionCatalog";
import { HidUsageGrid } from "./HidUsageGrid";
import { HidUsagePicker, type HidUsagePage } from "./HidUsagePicker";
import { validateBindingParameters, validateValue } from "./parameters";

export interface BehaviorBindingPickerProps {
  binding: BehaviorBinding;
  behaviors: GetBehaviorDetailsResponse[];
  layers: { id: number; name: string }[];
  isDisabled?: boolean;
  onBindingChanged: (binding: BehaviorBinding) => void;
}

type BrowserTab = "keys" | "actions" | "multi";
type ActionGroupId =
  | "flow"
  | "layers"
  | "typing"
  | "connectivity"
  | "pointer"
  | "lighting"
  | "power"
  | "other";

interface ActionPresentation {
  group: ActionGroupId;
  description: string;
  icon: LucideIcon;
  warning?: string;
}

interface EditorState {
  behaviorId: number;
  param1?: number;
  param2?: number;
}

const ACTION_GROUPS: readonly { id: ActionGroupId; label: string }[] = [
  { id: "flow", label: "Keymap flow" },
  { id: "layers", label: "Layers" },
  { id: "typing", label: "Typing helpers" },
  { id: "connectivity", label: "Connectivity" },
  { id: "pointer", label: "Mouse & pointer" },
  { id: "lighting", label: "Lighting" },
  { id: "power", label: "Power & system" },
  { id: "other", label: "Other actions" },
];

function normalizeName(name: string): string {
  return name
    .toLocaleLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isEmptyParameter(values: BehaviorParameterValueDescription[]) {
  return (
    values.length === 0 || values.every((value) => value.nil !== undefined)
  );
}

function isCanonicalKeyPress(behavior: GetBehaviorDetailsResponse): boolean {
  return (
    normalizeName(behavior.displayName) === "key press" &&
    behavior.metadata.some(
      ({ param1, param2 }) =>
        param1.some((value) => value.hidUsage !== undefined) &&
        isEmptyParameter(param2),
    )
  );
}

function isMultiBehavior(behavior: GetBehaviorDetailsResponse): boolean {
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

function actionPresentation(
  behavior: GetBehaviorDetailsResponse,
): ActionPresentation {
  const name = normalizeName(behavior.displayName);

  if (name === "layer tap") {
    return {
      group: "layers",
      description: "Hold for a layer, tap for a key.",
      icon: Layers,
    };
  }
  if (name === "mod tap" || name === "hold tap") {
    return {
      group: "typing",
      description: "Hold for a modifier, tap for a key.",
      icon: Sparkles,
    };
  }
  if (name.includes("transparent")) {
    return {
      group: "flow",
      description: "Use the assignment from the next active layer.",
      icon: Eye,
    };
  }
  if (name === "none" || name.includes("disabled")) {
    return {
      group: "flow",
      description: "Leave this key inactive on the current layer.",
      icon: Ban,
    };
  }
  if (name.includes("layer")) {
    return {
      group: "layers",
      description: name.includes("momentary")
        ? "Open another layer while this key is held."
        : "Switch or toggle another layer.",
      icon: Layers,
    };
  }
  if (
    name.includes("caps word") ||
    name.includes("repeat") ||
    name.includes("sticky") ||
    name.includes("key toggle")
  ) {
    return {
      group: "typing",
      description: name.includes("repeat")
        ? "Repeat the most recent key press."
        : "Apply a keyboard-aware typing mode.",
      icon: Repeat2,
    };
  }
  if (name.includes("bluetooth")) {
    return {
      group: "connectivity",
      description: "Select, disconnect, or clear a wireless profile.",
      icon: Bluetooth,
      warning:
        "This action can disconnect the active device or clear saved wireless profiles. Review the selected operation before applying the draft.",
    };
  }
  if (name.includes("output") || name.includes("usb")) {
    return {
      group: "connectivity",
      description: "Choose where the keyboard sends its output.",
      icon: Cable,
    };
  }
  if (
    name.includes("mouse") ||
    name.includes("pointer") ||
    name.includes("scroll")
  ) {
    return {
      group: "pointer",
      description: "Send a pointer button, movement, or scroll action.",
      icon: MousePointer2,
    };
  }
  if (
    name.includes("rgb") ||
    name.includes("backlight") ||
    name.includes("lighting")
  ) {
    return {
      group: "lighting",
      description: "Control the keyboard lighting.",
      icon: Lightbulb,
    };
  }
  if (
    name.includes("power") ||
    name.includes("soft off") ||
    name.includes("reset") ||
    name.includes("bootloader")
  ) {
    return {
      group: "power",
      description: "Control keyboard power or firmware state.",
      icon: Power,
      warning:
        "This action can power down, reset, or change the keyboard firmware state. Review it before applying the draft.",
    };
  }

  return {
    group: "other",
    description: "Configure an action reported by this keyboard.",
    icon: ToggleLeft,
  };
}

function hasConfigurableParameters(behavior: GetBehaviorDetailsResponse) {
  return behavior.metadata.some(({ param1, param2 }) =>
    [...param1, ...param2].some((value) => value.nil === undefined),
  );
}

function defaultParameter(
  values: BehaviorParameterValueDescription[] | undefined,
  layers: { id: number; name: string }[],
): number | undefined {
  if (!values || values.length === 0 || values.every((value) => value.nil)) {
    return 0;
  }

  const constantValues = values.filter((value) => value.constant !== undefined);
  if (constantValues.length > 0) {
    const preferred = constantValues.find(
      ({ name }) =>
        !/(clear|disconnect|erase|reset|bootloader|soft off|power off)/i.test(
          name,
        ),
    );
    return (preferred || constantValues[0]).constant;
  }

  for (const value of values) {
    if (value.layerId !== undefined) return layers[0]?.id;
    if (value.range) return value.range.min;
    if (value.nil !== undefined) return 0;
    if (value.hidUsage !== undefined) return undefined;
  }

  return undefined;
}

function createEditorState(
  behavior: GetBehaviorDetailsResponse,
  binding: BehaviorBinding,
  layers: { id: number; name: string }[],
): EditorState {
  if (binding.behaviorId === behavior.id) {
    return {
      behaviorId: behavior.id,
      param1: binding.param1,
      param2: binding.param2,
    };
  }

  const metadata = behavior.metadata[0];
  return {
    behaviorId: behavior.id,
    param1: defaultParameter(metadata?.param1, layers),
    param2: defaultParameter(metadata?.param2, layers),
  };
}

function tabForBehavior(
  behavior: GetBehaviorDetailsResponse | undefined,
): BrowserTab {
  if (behavior && isCanonicalKeyPress(behavior)) return "keys";
  if (behavior && isMultiBehavior(behavior)) return "multi";
  return "actions";
}

function behaviorMatchesQuery(
  behavior: GetBehaviorDetailsResponse,
  query: string,
): boolean {
  const normalizedQuery = normalizeName(query);
  if (!normalizedQuery) return true;

  const presentation = actionPresentation(behavior);
  const groupLabel = ACTION_GROUPS.find(
    ({ id }) => id === presentation.group,
  )?.label;
  const haystack = normalizeName(
    [
      behavior.displayName,
      presentation.description,
      groupLabel,
      ...behavior.metadata.flatMap(({ param1, param2 }) =>
        [...param1, ...param2].map(({ name }) => name),
      ),
    ]
      .filter(Boolean)
      .join(" "),
  );

  return normalizedQuery.split(" ").every((token) => haystack.includes(token));
}

function BehaviorCard({
  behavior,
  selected,
  disabled,
  onSelect,
}: {
  behavior: GetBehaviorDetailsResponse;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const presentation = actionPresentation(behavior);
  const Icon = presentation.icon;

  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`group grid min-h-24 grid-cols-[auto_1fr] content-center gap-x-3 rounded-xl border p-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-45 ${
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-line bg-base-100 text-base-content hover:border-primary/45 hover:bg-primary/5"
      }`}
    >
      <span className="row-span-2 grid size-9 place-items-center rounded-lg bg-base-300 text-base-content/65 transition group-hover:text-primary">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <span className="text-sm font-semibold leading-tight">
        {behavior.displayName}
      </span>
      <span className="mt-1 line-clamp-2 text-[0.6875rem] leading-snug text-base-content/55">
        {presentation.description}
      </span>
    </button>
  );
}

export const BehaviorBindingPicker = ({
  binding,
  layers,
  behaviors,
  isDisabled = false,
  onBindingChanged,
}: BehaviorBindingPickerProps) => {
  const currentBehavior = useMemo(
    () => behaviors.find((behavior) => behavior.id === binding.behaviorId),
    [behaviors, binding.behaviorId],
  );
  const currentTab = tabForBehavior(currentBehavior);
  const [activeTab, setActiveTab] = useState<BrowserTab>(currentTab);
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);

  const keyPressBehavior = useMemo(
    () => behaviors.find(isCanonicalKeyPress),
    [behaviors],
  );
  const multiBehaviors = useMemo(
    () =>
      behaviors
        .filter(isMultiBehavior)
        .sort((left, right) =>
          left.displayName.localeCompare(right.displayName),
        ),
    [behaviors],
  );
  const actionBehaviors = useMemo(
    () =>
      behaviors
        .filter(
          (behavior) =>
            !isCanonicalKeyPress(behavior) && !isMultiBehavior(behavior),
        )
        .sort((left, right) =>
          left.displayName.localeCompare(right.displayName),
        ),
    [behaviors],
  );

  useEffect(() => {
    setEditor(null);
    setActiveTab(currentTab);
  }, [binding.behaviorId, binding.param1, binding.param2, currentTab]);

  const keyUsageDescription = useMemo(
    () =>
      keyPressBehavior?.metadata
        .flatMap(({ param1 }) => param1)
        .find(({ hidUsage }) => hidUsage !== undefined)?.hidUsage,
    [keyPressBehavior],
  );

  const usagePages = useMemo<HidUsagePage[]>(() => {
    if (!keyUsageDescription) return [];

    const pages: HidUsagePage[] = [];
    if (keyUsageDescription.keyboardMax > 0) {
      pages.push({
        id: 7,
        min: 4,
        max: keyUsageDescription.keyboardMax,
      });
    }
    if (keyUsageDescription.consumerMax > 0) {
      pages.push({
        id: 12,
        min: 1,
        max: keyUsageDescription.consumerMax,
      });
    }
    return pages;
  }, [keyUsageDescription]);

  const keyCatalog = useMemo(
    () => filterHidActionCatalogForUsagePages(usagePages),
    [usagePages],
  );

  const editorBehavior = useMemo(
    () =>
      editor
        ? behaviors.find((behavior) => behavior.id === editor.behaviorId)
        : undefined,
    [behaviors, editor],
  );
  const layerIds = useMemo(() => layers.map(({ id }) => id), [layers]);
  const editorIsValid = Boolean(
    editor &&
      editorBehavior &&
      validateBindingParameters(
        editorBehavior.metadata,
        layerIds,
        editor.param1,
        editor.param2,
      ),
  );

  const currentLabel = useMemo(() => {
    if (currentBehavior && isCanonicalKeyPress(currentBehavior)) {
      return describeHidUsage(binding.param1, keyCatalog);
    }
    return currentBehavior?.displayName || "Unavailable action";
  }, [binding.param1, currentBehavior, keyCatalog]);

  const chooseTab = (tab: BrowserTab) => {
    if (tab === "keys" && !keyPressBehavior) return;
    setActiveTab(tab);
    setEditor(null);
    setSearch("");
  };

  const chooseKeyUsage = (usage: number) => {
    if (!keyPressBehavior || isDisabled) return;
    onBindingChanged({
      behaviorId: keyPressBehavior.id,
      param1: usage >>> 0,
      param2: 0,
    });
  };

  const chooseBehavior = (behavior: GetBehaviorDetailsResponse) => {
    if (isDisabled) return;

    const presentation = actionPresentation(behavior);
    if (!hasConfigurableParameters(behavior) && !presentation.warning) {
      onBindingChanged({ behaviorId: behavior.id, param1: 0, param2: 0 });
      return;
    }

    setEditor(createEditorState(behavior, binding, layers));
  };

  const changeParam1 = (param1?: number) => {
    if (!editor || !editorBehavior) return;
    const matchingSet = editorBehavior.metadata.find((set) =>
      validateValue(layerIds, param1, set.param1),
    );
    setEditor({
      ...editor,
      param1,
      param2: defaultParameter(matchingSet?.param2, layers),
    });
  };

  const assignEditor = () => {
    if (!editor || !editorBehavior || !editorIsValid || isDisabled) return;
    onBindingChanged({
      behaviorId: editor.behaviorId,
      param1: editor.param1 ?? 0,
      param2: editor.param2 ?? 0,
    });
  };

  const filteredActions = actionBehaviors.filter((behavior) =>
    behaviorMatchesQuery(behavior, search),
  );
  const filteredMulti = multiBehaviors.filter((behavior) =>
    behaviorMatchesQuery(behavior, search),
  );

  const editorName = editorBehavior
    ? normalizeName(editorBehavior.displayName)
    : "";
  const editorIsMulti = Boolean(
    editorBehavior && isMultiBehavior(editorBehavior),
  );
  const param1Label = editorIsMulti
    ? editorName === "layer tap"
      ? "Hold layer"
      : "Hold action"
    : undefined;
  const param2Label = editorIsMulti ? "Tap action" : undefined;

  return (
    <section aria-label="Assign key action" className="grid gap-4">
      <div className="flex items-center gap-3 rounded-xl border border-line bg-base-100 px-3 py-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-base-300 text-base-content/60">
          {currentTab === "keys" ? (
            <KeyboardIcon aria-hidden="true" className="size-4" />
          ) : currentTab === "multi" ? (
            <Sparkles aria-hidden="true" className="size-4" />
          ) : (
            <ToggleLeft aria-hidden="true" className="size-4" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-base-content/45">
            Current
          </span>
          <span className="block truncate text-sm font-semibold">
            {currentLabel}
          </span>
        </span>
      </div>

      <div
        role="group"
        aria-label="Assignment type"
        className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-base-100 p-1"
      >
        {(
          [
            ["keys", "Keys"],
            ["actions", "Actions"],
            ["multi", "Multi"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={activeTab === id}
            disabled={(id === "keys" && !keyPressBehavior) || isDisabled}
            onClick={() => chooseTab(id)}
            className="min-h-10 rounded-lg px-2 text-xs font-semibold text-base-content/55 outline-none transition hover:text-base-content focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-35 aria-pressed:bg-primary aria-pressed:text-primary-content aria-pressed:shadow-sm"
          >
            {label}
          </button>
        ))}
      </div>

      {editor && editorBehavior ? (
        <div className="grid gap-4">
          <button
            type="button"
            onClick={() => setEditor(null)}
            className="flex min-h-10 items-center gap-2 justify-self-start rounded-lg px-2 text-xs font-semibold text-base-content/60 outline-none hover:bg-base-300 hover:text-base-content focus-visible:ring-2 focus-visible:ring-focus"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            Back to {activeTab === "multi" ? "multi" : "actions"}
          </button>

          <div className="rounded-2xl border border-line bg-base-100 p-4">
            <p className="text-lg font-semibold">
              {editorBehavior.displayName}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-base-content/55">
              {editorIsMulti
                ? "Choose what happens when this key is held and when it is tapped."
                : actionPresentation(editorBehavior).description}
            </p>

            {actionPresentation(editorBehavior).warning && (
              <div className="mt-4 flex gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs leading-relaxed text-base-content/70">
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-warning"
                />
                {actionPresentation(editorBehavior).warning}
              </div>
            )}

            {hasConfigurableParameters(editorBehavior) && (
              <div className="mt-5 grid gap-4 border-t border-line pt-4">
                <BehaviorParametersPicker
                  metadata={editorBehavior.metadata}
                  param1={editor.param1}
                  param2={editor.param2}
                  param1Label={param1Label}
                  param2Label={param2Label}
                  layers={layers}
                  onParam1Changed={changeParam1}
                  onParam2Changed={(param2) =>
                    setEditor((current) =>
                      current ? { ...current, param2 } : current,
                    )
                  }
                />
              </div>
            )}

            <button
              type="button"
              disabled={!editorIsValid || isDisabled}
              onClick={assignEditor}
              className="mt-5 min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-content outline-none transition hover:bg-wafer-deep disabled:cursor-not-allowed disabled:bg-base-300 disabled:text-base-content/35 focus-visible:ring-2 focus-visible:ring-focus"
            >
              {editorIsValid ? "Assign to key" : "Finish required choices"}
            </button>
          </div>
        </div>
      ) : activeTab === "keys" ? (
        keyPressBehavior ? (
          <div className="grid gap-4">
            <HidUsageGrid
              value={
                binding.behaviorId === keyPressBehavior.id
                  ? binding.param1
                  : undefined
              }
              items={keyCatalog}
              disabled={isDisabled}
              onValueChange={chooseKeyUsage}
              ariaLabel="Choose a key or shortcut"
            />
            <details className="rounded-xl border border-line bg-base-100">
              <summary className="flex min-h-11 cursor-pointer list-none items-center px-3 text-xs font-semibold text-base-content/55 [&::-webkit-details-marker]:hidden">
                More firmware-supported usages
              </summary>
              <fieldset
                disabled={isDisabled}
                className="border-t border-line p-3 disabled:opacity-45"
              >
                <HidUsagePicker
                  label="Key or consumer usage"
                  value={
                    binding.behaviorId === keyPressBehavior.id
                      ? binding.param1
                      : undefined
                  }
                  usagePages={usagePages}
                  onValueChanged={(value) => {
                    if (value !== undefined) chooseKeyUsage(value);
                  }}
                />
              </fieldset>
            </details>
          </div>
        ) : (
          <p className="rounded-xl border border-line bg-base-100 p-4 text-sm text-base-content/60">
            This keyboard did not report a standard key-press action.
          </p>
        )
      ) : (
        <div className="grid gap-5">
          <label className="grid gap-1.5">
            <span className="sr-only">
              Search {activeTab === "multi" ? "multi actions" : "actions"}
            </span>
            <span className="flex min-h-11 items-center rounded-xl border border-line bg-raised focus-within:ring-2 focus-within:ring-focus">
              <Search
                aria-hidden="true"
                className="ml-3 size-4 text-base-content/45"
              />
              <input
                type="search"
                value={search}
                disabled={isDisabled}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder={
                  activeTab === "multi"
                    ? "Search tap and hold…"
                    : "Search actions…"
                }
                className="min-h-10 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-base-content/40"
              />
            </span>
          </label>

          {activeTab === "actions" ? (
            ACTION_GROUPS.map(({ id, label }) => {
              const groupBehaviors = filteredActions.filter(
                (behavior) => actionPresentation(behavior).group === id,
              );
              if (groupBehaviors.length === 0) return null;

              return (
                <section key={id} aria-labelledby={`action-group-${id}`}>
                  <h3
                    id={`action-group-${id}`}
                    className="mb-2 text-sm font-semibold"
                  >
                    {label}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {groupBehaviors.map((behavior) => (
                      <BehaviorCard
                        key={behavior.id}
                        behavior={behavior}
                        selected={binding.behaviorId === behavior.id}
                        disabled={isDisabled}
                        onSelect={() => chooseBehavior(behavior)}
                      />
                    ))}
                  </div>
                </section>
              );
            })
          ) : filteredMulti.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {filteredMulti.map((behavior) => (
                <BehaviorCard
                  key={behavior.id}
                  behavior={behavior}
                  selected={binding.behaviorId === behavior.id}
                  disabled={isDisabled}
                  onSelect={() => chooseBehavior(behavior)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line bg-base-100 px-4 py-8 text-center">
              <p className="text-sm font-semibold">
                {search
                  ? "No matching multi actions"
                  : "No multi actions available"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-base-content/55">
                Multi shows hold/tap behaviors already provided by this
                keyboard.
              </p>
            </div>
          )}

          {activeTab === "actions" && filteredActions.length === 0 && (
            <div className="rounded-xl border border-dashed border-line bg-base-100 px-4 py-8 text-center">
              <p className="text-sm font-semibold">No matching actions</p>
              <p className="mt-1 text-xs text-base-content/55">
                Try Bluetooth, layer, mouse, lighting, or power.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
