import { useEffect, useMemo, useRef, useState } from "react";

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
  ChevronRight,
  Eye,
  Layers,
  Lightbulb,
  MousePointer2,
  Power,
  Repeat2,
  Sparkles,
  ToggleLeft,
  type LucideIcon,
} from "lucide-react";

import { BehaviorParametersPicker } from "./BehaviorParametersPicker";
import {
  filterHidActionCatalogForUsagePages,
  searchHidActionCatalog,
  HID_CONSUMER_ACTION_CATEGORY_IDS,
  HID_CONSUMER_USAGE_PAGE,
  HID_KEYBOARD_ACTION_CATEGORY_IDS,
  HID_KEYBOARD_USAGE_PAGE,
} from "./actionCatalog";
import { HidUsageGrid } from "./HidUsageGrid";
import { HidUsagePicker, type HidUsagePage } from "./HidUsagePicker";
import { validateBindingParameters, validateValue } from "./parameters";
import { ActionRow } from "../design-system/ActionRow";
import { SearchField } from "../design-system/SearchField";
import {
  isCanonicalKeyPress,
  isMultiBehavior,
  normalizeName,
} from "./behaviorKinds";

export interface BehaviorBindingPickerProps {
  binding: BehaviorBinding;
  behaviors: GetBehaviorDetailsResponse[];
  layers: { id: number; name: string }[];
  isDisabled?: boolean;
  onBindingChanged: (binding: BehaviorBinding) => void;
}

type ActionGroupId =
  | "flow"
  | "layers"
  | "typing"
  | "connectivity"
  | "pointer"
  | "lighting"
  | "power"
  | "routines"
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

const ACTION_GROUPS: readonly {
  id: ActionGroupId;
  label: string;
  shortLabel: string;
}[] = [
  { id: "flow", label: "Keymap flow", shortLabel: "Flow" },
  { id: "layers", label: "Layers", shortLabel: "Layers" },
  { id: "typing", label: "Typing helpers", shortLabel: "Typing" },
  { id: "connectivity", label: "Connectivity", shortLabel: "Connect" },
  { id: "pointer", label: "Mouse & pointer", shortLabel: "Pointer" },
  { id: "lighting", label: "Lighting", shortLabel: "Light" },
  { id: "power", label: "Power & system", shortLabel: "System" },
  { id: "routines", label: "Firmware routines", shortLabel: "Routines" },
  { id: "other", label: "Other actions", shortLabel: "Other" },
];

/** Stable DOM ids, so the jump bar and the sections cannot drift apart. */
const SECTION_IDS = {
  keys: "wafer-picker-keys",
  media: "wafer-picker-media",
  multi: "wafer-picker-multi",
} as const;

/**
 * One block in the picker. Open by default; collapsible if you want it gone.
 *
 * This has now been three designs. A tab strip hid nine tenths of the catalogue
 * behind a guess about which bucket a thing was in. Expanding everything fixed
 * that and produced a list too long to scroll. Collapsing everything by default
 * fixed *that* and quietly recreated the first problem — ten shut headings is a
 * tab strip drawn vertically, and the reported symptom was the same one:
 * "a lot of features are hidden, and for anybody who doesn't know, it's not on
 * the screen."
 *
 * So: everything is open, and the length problem is solved by *navigation*
 * rather than by concealment — see the jump bar in the panel below. Collapsing
 * stays available, because a user who never wants Lighting should be able to
 * fold it away; it is just no longer the default state of the whole panel.
 */
function PickerGroup({
  id,
  label,
  count,
  defaultOpen = true,
  forceOpen = false,
  children,
}: {
  id: string;
  label: string;
  count: number;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = forceOpen || open;

  return (
    // `scroll-mt` so a jump lands with the heading below the sticky bar rather
    // than underneath it.
    <section id={id} aria-label={label} className="scroll-mt-12">
      <h3>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setOpen((previous) => !previous)}
          className="flex min-h-9 w-full items-center gap-1.5 rounded-control px-1 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-tertiary outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"
        >
          <ChevronRight
            aria-hidden="true"
            className={`size-3.5 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
          />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <span className="font-mono text-[0.625rem] tabular-nums text-tertiary/70">
            {count}
          </span>
        </button>
      </h3>
      {isOpen && <div className="pb-1 pt-0.5">{children}</div>}
    </section>
  );
}

/**
 * The jump bar: every section in the panel, always on screen.
 *
 * This is not the tab strip that was removed. A tab strip *replaces* the view
 * with one bucket, so everything else stops existing; this scrolls to a heading
 * in a list that is entirely present either way. The distinction matters
 * because the failure mode of the tab strip was people not finding things that
 * were behind a tab they did not guess — here there is nothing to guess, the
 * counts are visible, and scrolling past everything still works.
 */
function JumpBar({
  sections,
}: {
  sections: readonly { id: string; label: string; count: number }[];
}) {
  if (sections.length < 2) return null;

  return (
    <nav
      aria-label="Jump to a section"
      // `wafer-scroll-bare`: a scrollbar under a single row of chips is a
      // second horizontal rule where a border already is, and on Windows it
      // was a full-width platform-grey slab sitting on the first section
      // heading. The chips are visibly cut off when they overflow, which is
      // the cue; the bar was only ever noise.
      // `bg-panel` at full alpha, matching the rail exactly — see the note on
      // the assignment aside in `Keyboard.tsx`. No `backdrop-blur`: blurring
      // here would sample the parent's own fill and tint the strip, which is
      // the artefact this is fixing rather than a way to fix it.
      className="wafer-scroll-bare sticky top-0 z-10 -mx-3 flex gap-1 overflow-x-auto border-b border-line-subtle bg-panel px-3 pb-2 pt-1.5"
    >
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() =>
            document
              .getElementById(section.id)
              ?.scrollIntoView({ block: "start", behavior: "smooth" })
          }
          className="wafer-dispersive flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border border-line-subtle px-2.5 text-[0.6875rem] font-semibold text-muted outline-none transition-colors hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"
        >
          {section.label}
          <span className="font-mono text-[0.625rem] tabular-nums text-tertiary">
            {section.count}
          </span>
        </button>
      ))}
    </nav>
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
    name.includes("grave escape") ||
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
    name.includes("macro") ||
    name.includes("tap dance") ||
    name.includes("mod morph") ||
    name.includes("routine")
  ) {
    return {
      group: "routines",
      description: "Run an action already configured in this firmware.",
      icon: Sparkles,
    };
  }
  if (
    name.includes("power") ||
    name.includes("soft off") ||
    name.includes("reset") ||
    name.includes("bootloader") ||
    name.includes("studio unlock")
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
  const metadataUnavailable = behavior.metadata.length === 0;

  return (
    <ActionRow
      icon={presentation.icon}
      title={behavior.displayName}
      description={
        metadataUnavailable
          ? "This firmware does not expose Studio-editable parameters."
          : presentation.description
      }
      selected={selected}
      disabled={disabled || metadataUnavailable}
      onPress={onSelect}
    />
  );
}

export const BehaviorBindingPicker = ({
  binding,
  layers,
  behaviors,
  isDisabled = false,
  onBindingChanged,
}: BehaviorBindingPickerProps) => {
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
  /**
   * Close the editor when the binding changes *underneath* us.
   *
   * The guard is the whole point. Everything in this panel applies live, so the
   * moment you pick a parameterised behavior — Bluetooth, layer-tap, anything
   * with a second choice to make — it is published, comes straight back as a
   * new `binding` prop, and an unguarded reset here slammed the editor shut on
   * the click that opened it. The behavior was bound, so nothing looked broken;
   * it was simply impossible to reach the parameters, which is the report that
   * "menus with settings like Bluetooth close after selection despite being
   * configurable".
   *
   * Echoes of our own writes are therefore ignored, and a binding that arrives
   * from anywhere else — undo, a bulk paint, retargeting onto another key —
   * still closes the editor, because that one really is about a different key.
   */
  const publishedRef = useRef<BehaviorBinding | null>(null);

  useEffect(() => {
    const mine = publishedRef.current;
    if (
      mine &&
      mine.behaviorId === binding.behaviorId &&
      mine.param1 === binding.param1 &&
      mine.param2 === binding.param2
    ) {
      return;
    }

    publishedRef.current = null;
    setEditor(null);
  }, [binding.behaviorId, binding.param1, binding.param2]);

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

  /*
   * The catalogue is split by HID page so the consumer usages get a heading of
   * their own instead of trailing the alphabet.
   *
   * They were the last sections of a single grid, which meant volume, playback,
   * brightness and the browser keys sat below a hundred-odd letters, digits and
   * symbols — present in the product, invisible in it. A second group puts the
   * whole class one click from the top of the panel, and its count advertises
   * that there is something there worth opening.
   *
   * Both halves are still whatever the firmware said it accepts: a board that
   * reports no consumer range gets no consumer group at all, rather than a
   * heading over an empty grid.
   */
  const keyboardCatalog = useMemo(
    () =>
      keyCatalog.filter(
        ({ usagePage }) => usagePage === HID_KEYBOARD_USAGE_PAGE,
      ),
    [keyCatalog],
  );
  const consumerCatalog = useMemo(
    () =>
      keyCatalog.filter(
        ({ usagePage }) => usagePage === HID_CONSUMER_USAGE_PAGE,
      ),
    [keyCatalog],
  );

  // Counts drive both the badge and whether a group is worth drawing while a
  // search is running, so they are the searched counts rather than the totals.
  const matchingKeyboardCount = useMemo(
    () => searchHidActionCatalog(search, keyboardCatalog).length,
    [keyboardCatalog, search],
  );
  const matchingConsumerCount = useMemo(
    () => searchHidActionCatalog(search, consumerCatalog).length,
    [consumerCatalog, search],
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

  const chooseKeyUsage = (usage: number) => {
    if (!keyPressBehavior || isDisabled) return;
    onBindingChanged({
      behaviorId: keyPressBehavior.id,
      param1: usage >>> 0,
      param2: 0,
    });
  };

  /**
   * Push an editor state onto the key, but only once it is actually valid.
   *
   * Everything here edits live. Choosing a key applied instantly while
   * choosing an action made you press "Assign to key" afterwards, which is two
   * different ideas of what a click means inside one panel — and the button was
   * a commit inside a commit, since the draft already holds everything back
   * until Review. Now a click is a click, and the key on the canvas updates as
   * you refine the parameters.
   *
   * Invalid intermediate states are simply not sent; the panel says what is
   * still missing instead of disabling a button that explains nothing.
   */
  const publish = (next: EditorState, behavior: GetBehaviorDetailsResponse) => {
    if (isDisabled) return;
    if (
      !validateBindingParameters(
        behavior.metadata,
        layerIds,
        next.param1,
        next.param2,
      )
    ) {
      return;
    }
    const published = {
      behaviorId: next.behaviorId,
      param1: next.param1 ?? 0,
      param2: next.param2 ?? 0,
    };

    // Recorded before the call, because a synchronous parent can hand the new
    // binding back before this function has returned.
    publishedRef.current = published;
    onBindingChanged(published);
  };

  const chooseBehavior = (behavior: GetBehaviorDetailsResponse) => {
    if (isDisabled || behavior.metadata.length === 0) return;

    if (!hasConfigurableParameters(behavior)) {
      onBindingChanged({ behaviorId: behavior.id, param1: 0, param2: 0 });
      return;
    }

    // Open the parameters *and* apply the defaults, so the key changes on the
    // click that chose it rather than waiting for a second confirmation.
    const next = createEditorState(behavior, binding, layers);
    setEditor(next);
    publish(next, behavior);
  };

  const changeParam1 = (param1?: number) => {
    if (!editor || !editorBehavior) return;
    const matchingSet = editorBehavior.metadata.find((set) =>
      validateValue(layerIds, param1, set.param1),
    );
    const next = {
      ...editor,
      param1,
      param2: defaultParameter(matchingSet?.param2, layers),
    };
    setEditor(next);
    publish(next, editorBehavior);
  };

  const changeParam2 = (param2?: number) => {
    if (!editor || !editorBehavior) return;
    const next = { ...editor, param2 };
    setEditor(next);
    publish(next, editorBehavior);
  };

  // Undefined unless the key is currently bound to the plain key press, so a
  // key holding a hold-tap does not light a usage up as if it were selected.
  const selectedKeyUsage =
    keyPressBehavior && binding.behaviorId === keyPressBehavior.id
      ? binding.param1
      : undefined;

  const filteredActions = actionBehaviors.filter((behavior) =>
    behaviorMatchesQuery(behavior, search),
  );
  const filteredMulti = multiBehaviors.filter((behavior) =>
    behaviorMatchesQuery(behavior, search),
  );

  /**
   * What the jump bar lists, in the order the panel renders.
   *
   * Built from the same conditions the sections themselves use, so a section
   * that is not drawn cannot appear as a chip pointing at nothing — which is
   * the one way a navigation bar is worse than no navigation bar.
   */
  const sections: { id: string; label: string; count: number }[] = [];

  if (keyPressBehavior && (!search || matchingKeyboardCount > 0)) {
    sections.push({
      id: SECTION_IDS.keys,
      label: "Keys",
      count: matchingKeyboardCount,
    });
  }
  if (
    keyPressBehavior &&
    consumerCatalog.length > 0 &&
    (!search || matchingConsumerCount > 0)
  ) {
    sections.push({
      id: SECTION_IDS.media,
      label: "Media & system",
      count: matchingConsumerCount,
    });
  }
  if (filteredMulti.length > 0) {
    sections.push({
      id: SECTION_IDS.multi,
      label: "Tap and hold",
      count: filteredMulti.length,
    });
  }
  for (const { id, label, shortLabel } of ACTION_GROUPS) {
    const count = filteredActions.filter(
      (behavior) => actionPresentation(behavior).group === id,
    ).length;
    if (count > 0) {
      sections.push({
        id: `wafer-actions-${id}`,
        label: shortLabel ?? label,
        count,
      });
    }
  }

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
    // One list, grouped by heading. There used to be a Keys/Actions/Multi tab
    // strip on top of a category chip strip — two levels of navigation over a
    // list short enough to scroll, which meant finding anything required
    // guessing which of twelve buckets it was filed under first. Everything is
    // now on one scroll, in one order, and search cuts across all of it.
    <section aria-label="Assign key action" className="grid gap-3">
      {editor && editorBehavior ? (
        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => setEditor(null)}
            className="flex min-h-10 items-center gap-2 justify-self-start rounded-lg px-2 text-xs font-semibold text-base-content/60 outline-none hover:bg-base-300 hover:text-base-content focus-visible:ring-2 focus-visible:ring-focus"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            Back to the list
          </button>

          <div>
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
              <div className="mt-4 grid gap-3 border-t border-line-subtle pt-4">
                <BehaviorParametersPicker
                  metadata={editorBehavior.metadata}
                  param1={editor.param1}
                  param2={editor.param2}
                  param1Label={param1Label}
                  param2Label={param2Label}
                  layers={layers}
                  onParam1Changed={changeParam1}
                  onParam2Changed={changeParam2}
                />
              </div>
            )}

            {/* Replaces the Apply button. The key is already bound; this only
                reports when a choice is still outstanding. */}
            <p
              aria-live="polite"
              className="mt-4 text-xs leading-relaxed text-tertiary"
            >
              {editorIsValid
                ? "Applied to the key. Nothing reaches the keyboard until you review the draft."
                : "Choose the remaining option to apply this to the key."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          <SearchField
            ariaLabel="Search keys and actions"
            value={search}
            disabled={isDisabled}
            onChange={setSearch}
            placeholder="Search keys and actions…"
          />

          <JumpBar sections={sections} />

          {/* Keys first: it is what the overwhelming majority of bindings are.
              Media & system follows it rather than sitting above it — putting
              the smaller, rarer group first was a way of compensating for it
              being collapsed, and once nothing is collapsed the compensation
              is just a wrong reading order.

              The grid carries its own search box, which put two search fields
              one above the other in a rail this narrow. It is driven by the
              panel's search instead — one field filters keys and actions
              together, which is what a single box in a single list implies. */}
          {keyPressBehavior ? (
            <>
              {(!search || matchingKeyboardCount > 0) && (
                <PickerGroup
                  id={SECTION_IDS.keys}
                  label="Keys"
                  count={matchingKeyboardCount}
                  forceOpen={Boolean(search)}
                >
                  <HidUsageGrid
                    value={selectedKeyUsage}
                    items={keyboardCatalog}
                    categoryIds={HID_KEYBOARD_ACTION_CATEGORY_IDS}
                    disabled={isDisabled}
                    onValueChange={chooseKeyUsage}
                    ariaLabel="Choose a key or shortcut"
                    showSearch={false}
                    searchValue={search}
                  />
                  {!search && (
                    <details className="mt-2 rounded-xl border border-line bg-base-100">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center px-3 text-xs font-semibold text-base-content/55 [&::-webkit-details-marker]:hidden">
                        More firmware-supported usages
                      </summary>
                      <fieldset
                        disabled={isDisabled}
                        className="border-t border-line p-3 disabled:opacity-45"
                      >
                        <HidUsagePicker
                          label="Key or consumer usage"
                          value={selectedKeyUsage}
                          usagePages={usagePages}
                          onValueChanged={(value) => {
                            if (value !== undefined) chooseKeyUsage(value);
                          }}
                        />
                      </fieldset>
                    </details>
                  )}
                </PickerGroup>
              )}

              {consumerCatalog.length > 0 &&
                (!search || matchingConsumerCount > 0) && (
                  <PickerGroup
                    id={SECTION_IDS.media}
                    label="Media & system"
                    count={matchingConsumerCount}
                    forceOpen={Boolean(search)}
                  >
                    <HidUsageGrid
                      value={selectedKeyUsage}
                      items={consumerCatalog}
                      categoryIds={HID_CONSUMER_ACTION_CATEGORY_IDS}
                      disabled={isDisabled}
                      onValueChange={chooseKeyUsage}
                      ariaLabel="Choose a media, system, or browser control"
                      emptyMessage="No matching media or system controls."
                      showSearch={false}
                      /* A consumer usage carries no implicit modifier — Ctrl +
                         Volume Up is not a thing the report can express — and
                         the keys grid above already owns the one chord panel
                         this rail should have. */
                      showModifiers={false}
                      searchValue={search}
                    />
                  </PickerGroup>
                )}
            </>
          ) : (
            <p className="rounded-xl border border-line bg-base-100 p-4 text-sm text-base-content/60">
              This keyboard did not report a standard key-press action.
            </p>
          )}

          {filteredMulti.length > 0 && (
            <PickerGroup
              id={SECTION_IDS.multi}
              label="Tap and hold"
              count={filteredMulti.length}
              forceOpen={Boolean(search)}
            >
              <div className="grid gap-1">
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
            </PickerGroup>
          )}

          {ACTION_GROUPS.map(({ id, label }) => {
            const groupBehaviors = filteredActions.filter(
              (behavior) => actionPresentation(behavior).group === id,
            );
            if (groupBehaviors.length === 0) return null;

            return (
              <PickerGroup
                key={id}
                id={`wafer-actions-${id}`}
                label={label}
                count={groupBehaviors.length}
                forceOpen={Boolean(search)}
              >
                <div className="grid gap-1">
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
              </PickerGroup>
            );
          })}

          {/* Said plainly, where people look for the thing that is missing.
              A binding in this protocol is one behavior id and two numbers,
              so there is no way to express one behavior wrapped around
              another. Composite hold-taps, macros and tap-dances are built
              when the firmware is compiled; Studio can bind the ones your
              board already has, and cannot author new ones. Leaving that
              unsaid just means people hunt for a feature that is not there. */}
          {!search && (
            <div className="border-t border-line-subtle pt-3 text-[0.6875rem] leading-relaxed text-tertiary">
              <p>
                Each behavior decides what its own two parameters accept.
                Mod-tap takes two keycodes because its firmware definition wires
                both sides to key presses; layer-tap takes a layer and a keycode
                because its definition wires the hold side to a layer.
              </p>
              <p className="mt-2">
                Pairing sides that no existing behavior pairs — hold a Bluetooth
                action, tap a layer — needs a new hold-tap written into the
                keymap and compiled. The same is true of macros and tap-dances.
                Studio assigns what your firmware already defines; it cannot
                define new ones.
              </p>
            </div>
          )}

          {search &&
            filteredActions.length === 0 &&
            filteredMulti.length === 0 && (
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
