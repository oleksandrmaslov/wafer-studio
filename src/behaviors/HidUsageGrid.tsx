import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Search, X } from "lucide-react";

import {
  findHidActionForUsage,
  getHidBaseUsage,
  getHidImplicitModifierMask,
  HID_ACTION_CATALOG,
  HID_ACTION_CATEGORY_BY_ID,
  HID_ACTION_CATEGORY_IDS,
  HID_IMPLICIT_MODIFIERS,
  searchHidActionCatalog,
  withHidImplicitModifiers,
  type HidActionCatalogItem,
  type HidActionCategoryId,
} from "./actionCatalog";

export interface HidUsageGridProps {
  value?: number;
  onValueChange: (value: number) => void;
  onActionSelected?: (action: HidActionCatalogItem) => void;
  items?: readonly HidActionCatalogItem[];
  categoryIds?: readonly HidActionCategoryId[];
  searchValue?: string;
  defaultSearchValue?: string;
  onSearchValueChange?: (value: string) => void;
  searchPlaceholder?: string;
  ariaLabel?: string;
  emptyMessage?: string;
  showSearch?: boolean;
  showModifiers?: boolean;
  autoFocusSearch?: boolean;
  disabled?: boolean;
  className?: string;
}

interface CatalogSection {
  id: HidActionCategoryId;
  items: HidActionCatalogItem[];
}

function actionButtons(container: HTMLElement | null): HTMLButtonElement[] {
  if (!container) return [];

  return Array.from(
    container.querySelectorAll<HTMLButtonElement>(
      "button[data-hid-action-id]:not(:disabled)",
    ),
  );
}

function centerOf(element: HTMLElement): { x: number; y: number } {
  const bounds = element.getBoundingClientRect();
  return {
    x: bounds.left + bounds.width / 2,
    y: bounds.top + bounds.height / 2,
  };
}

function verticalNeighbor(
  buttons: HTMLButtonElement[],
  current: HTMLButtonElement,
  direction: "up" | "down",
): HTMLButtonElement | undefined {
  const currentCenter = centerOf(current);
  const candidates = buttons
    .filter((button) => button !== current)
    .map((button) => {
      const center = centerOf(button);
      const primaryDistance =
        direction === "up"
          ? currentCenter.y - center.y
          : center.y - currentCenter.y;

      return {
        button,
        primaryDistance,
        crossDistance: Math.abs(center.x - currentCenter.x),
      };
    })
    .filter(({ primaryDistance }) => primaryDistance > 1)
    .sort(
      (left, right) =>
        left.primaryDistance * 4 +
        left.crossDistance -
        (right.primaryDistance * 4 + right.crossDistance),
    );

  return candidates[0]?.button;
}

function actionDescription(
  action: HidActionCatalogItem | undefined,
  modifierMask: number,
): string {
  if (!action) return "";

  const modifiers = HID_IMPLICIT_MODIFIERS.filter(
    ({ mask }) => (modifierMask & mask) === mask,
  ).map(({ label }) => label);

  return [...modifiers, action.name].join(" + ");
}

export function HidUsageGrid({
  value,
  onValueChange,
  onActionSelected,
  items = HID_ACTION_CATALOG,
  categoryIds = HID_ACTION_CATEGORY_IDS,
  searchValue,
  defaultSearchValue = "",
  onSearchValueChange,
  searchPlaceholder = "Search keys and controls…",
  ariaLabel = "Key and consumer usages",
  emptyMessage = "No matching keys or controls.",
  showSearch = true,
  showModifiers = true,
  autoFocusSearch = false,
  disabled = false,
  className,
}: HidUsageGridProps) {
  const instanceId = useId();
  const catalogRef = useRef<HTMLDivElement>(null);
  const [internalSearchValue, setInternalSearchValue] =
    useState(defaultSearchValue);
  const [activeActionId, setActiveActionId] = useState<string>();

  const resolvedSearchValue = searchValue ?? internalSearchValue;
  const requestedCategoryIds = useMemo(
    () => Array.from(new Set(categoryIds)),
    [categoryIds],
  );
  const categoryIdSet = useMemo(
    () => new Set<HidActionCategoryId>(requestedCategoryIds),
    [requestedCategoryIds],
  );

  const visibleItems = useMemo(
    () =>
      searchHidActionCatalog(resolvedSearchValue, items).filter((action) =>
        categoryIdSet.has(action.category),
      ),
    [categoryIdSet, items, resolvedSearchValue],
  );

  const sections = useMemo<CatalogSection[]>(
    () =>
      requestedCategoryIds
        .map((id) => ({
          id,
          items: visibleItems.filter((action) => action.category === id),
        }))
        .filter((section) => section.items.length > 0),
    [requestedCategoryIds, visibleItems],
  );

  const selectedAction = useMemo(
    () =>
      value === undefined ? undefined : findHidActionForUsage(value, items),
    [items, value],
  );

  const selectedActionIsVisible = selectedAction
    ? visibleItems.some((action) => action.id === selectedAction.id)
    : false;
  const activeActionIsVisible = activeActionId
    ? visibleItems.some((action) => action.id === activeActionId)
    : false;
  const tabStopId = activeActionIsVisible
    ? activeActionId
    : selectedActionIsVisible
      ? selectedAction?.id
      : visibleItems[0]?.id;

  const modifierMask =
    value === undefined ? 0 : getHidImplicitModifierMask(value);

  useEffect(() => {
    if (activeActionIsVisible) return;
    setActiveActionId(tabStopId);
  }, [activeActionIsVisible, tabStopId]);

  const updateSearchValue = (nextValue: string) => {
    if (searchValue === undefined) setInternalSearchValue(nextValue);
    onSearchValueChange?.(nextValue);
  };

  const focusAction = (button: HTMLButtonElement | undefined) => {
    if (!button) return;
    setActiveActionId(button.dataset.hidActionId);
    button.focus();
  };

  const handleActionKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const buttons = actionButtons(catalogRef.current);
    const currentIndex = buttons.indexOf(event.currentTarget);
    if (currentIndex < 0) return;

    let nextButton: HTMLButtonElement | undefined;

    switch (event.key) {
      case "ArrowLeft":
        nextButton =
          buttons[(currentIndex - 1 + buttons.length) % buttons.length];
        break;
      case "ArrowRight":
        nextButton = buttons[(currentIndex + 1) % buttons.length];
        break;
      case "ArrowUp":
        nextButton = verticalNeighbor(buttons, event.currentTarget, "up");
        break;
      case "ArrowDown":
        nextButton = verticalNeighbor(buttons, event.currentTarget, "down");
        break;
      case "Home": {
        const category = event.currentTarget.dataset.hidActionCategory;
        nextButton = buttons.find(
          (button) => button.dataset.hidActionCategory === category,
        );
        break;
      }
      case "End": {
        const category = event.currentTarget.dataset.hidActionCategory;
        const categoryButtons = buttons.filter(
          (button) => button.dataset.hidActionCategory === category,
        );
        nextButton = categoryButtons[categoryButtons.length - 1];
        break;
      }
      default:
        return;
    }

    if (!nextButton) return;
    event.preventDefault();
    focusAction(nextButton);
  };

  const selectAction = (action: HidActionCatalogItem) => {
    onValueChange(action.usage);
    onActionSelected?.(action);
  };

  const toggleModifier = (mask: number) => {
    if (value === undefined) return;

    onValueChange(
      withHidImplicitModifiers(getHidBaseUsage(value), modifierMask ^ mask),
    );
  };

  const rootClassName = ["grid gap-4", className].filter(Boolean).join(" ");
  const selectionDescription = actionDescription(selectedAction, modifierMask);

  return (
    <div className={rootClassName}>
      {showSearch && (
        <div className="grid gap-1.5">
          <label htmlFor={`${instanceId}-hid-search`} className="sr-only">
            Search keys and controls
          </label>
          <div className="flex min-h-10 items-center rounded-control border border-line-subtle bg-raised text-base-content transition focus-within:border-line-strong focus-within:ring-2 focus-within:ring-focus">
            <Search
              aria-hidden="true"
              className="ml-3 size-4 shrink-0 text-base-content/45"
            />
            <input
              id={`${instanceId}-hid-search`}
              type="search"
              value={resolvedSearchValue}
              placeholder={searchPlaceholder}
              autoFocus={autoFocusSearch}
              disabled={disabled}
              aria-controls={`${instanceId}-hid-catalog`}
              onChange={(event) => updateSearchValue(event.target.value)}
              className="min-h-10 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-base-content/40 disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-search-cancel-button]:hidden"
            />
            {resolvedSearchValue && (
              <button
                type="button"
                aria-label="Clear search"
                title="Clear search"
                disabled={disabled}
                onClick={() => updateSearchValue("")}
                className="mr-1 grid min-h-9 min-w-9 place-items-center rounded-md text-base-content/50 outline-none transition hover:bg-base-300 hover:text-base-content focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            )}
          </div>
          {resolvedSearchValue && (
            <p
              aria-live="polite"
              className="text-xs tabular-nums text-base-content/50"
            >
              {visibleItems.length}{" "}
              {visibleItems.length === 1 ? "result" : "results"}
            </p>
          )}
        </div>
      )}

      {showModifiers && (
        <fieldset className="grid gap-2 border-t border-line-subtle pt-3">
          <legend className="px-1 text-sm font-semibold text-base-content">
            Chord modifiers
          </legend>
          <p className="text-xs leading-relaxed text-base-content/55">
            {value === undefined
              ? "Pick a key below, then add modifiers to make it a shortcut."
              : "Held with the key above. Ctrl + C, Cmd + Shift + 4, and so on."}
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {HID_IMPLICIT_MODIFIERS.map((modifier) => {
              const pressed = (modifierMask & modifier.mask) === modifier.mask;

              return (
                <button
                  key={modifier.id}
                  type="button"
                  aria-label={modifier.label}
                  aria-pressed={pressed}
                  disabled={disabled || value === undefined}
                  onClick={() => toggleModifier(modifier.mask)}
                  className={`grid min-h-10 place-items-center rounded-md border px-1 text-center text-[0.625rem] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-40 ${
                    pressed
                      ? "border-line-strong bg-selected text-accent-foreground"
                      : "border-line-subtle bg-transparent text-base-content/60 hover:border-line hover:bg-hover hover:text-base-content"
                  }`}
                >
                  {modifier.shortLabel}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div
        ref={catalogRef}
        id={`${instanceId}-hid-catalog`}
        role="group"
        aria-label={ariaLabel}
        className="grid gap-4"
      >
        {sections.map((section) => {
          const category = HID_ACTION_CATEGORY_BY_ID[section.id];
          const headingId = `${instanceId}-${section.id}-heading`;

          return (
            <section key={section.id} aria-labelledby={headingId}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <h3
                  id={headingId}
                  className="text-xs font-semibold uppercase tracking-[0.08em] text-muted"
                >
                  {category.label}
                </h3>
                <span className="text-[0.6875rem] tabular-nums text-base-content/40">
                  {section.items.length}
                </span>
              </div>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-1.5">
                {section.items.map((action) => {
                  const selected = selectedAction?.id === action.id;

                  return (
                    <li key={action.id} className="min-w-0">
                      <button
                        type="button"
                        title={action.name}
                        aria-label={action.name}
                        aria-pressed={selected}
                        data-hid-action-id={action.id}
                        data-hid-action-category={action.category}
                        disabled={disabled}
                        tabIndex={tabStopId === action.id ? 0 : -1}
                        onFocus={() => setActiveActionId(action.id)}
                        onKeyDown={handleActionKeyDown}
                        onClick={() => selectAction(action)}
                        className={`grid min-h-11 w-full min-w-0 place-items-center rounded-control border px-1.5 py-1.5 text-center text-[0.6875rem] font-semibold leading-tight outline-none transition focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-base-200 disabled:cursor-not-allowed disabled:opacity-45 ${
                          selected
                            ? "border-line-strong bg-selected text-accent-foreground"
                            : "border-line-subtle bg-transparent text-base-content/75 hover:border-line hover:bg-hover hover:text-base-content"
                        }`}
                      >
                        <span className="max-w-full break-words">
                          {action.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        {sections.length === 0 && (
          <div className="rounded-xl border border-dashed border-line bg-base-100 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-base-content">
              {emptyMessage}
            </p>
            <p className="mt-1 text-xs text-base-content/55">
              Try a key name, symbol, or control such as volume or arrow.
            </p>
          </div>
        )}
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {selectionDescription
          ? `${selectionDescription} selected.`
          : "No key selected."}
      </p>
    </div>
  );
}
