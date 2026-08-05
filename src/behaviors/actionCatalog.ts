import {
  hid_usage_from_page_and_id,
  hid_usage_get_label,
  hid_usage_page_and_id_from_usage,
} from "../hid-usages";

export const HID_KEYBOARD_USAGE_PAGE = 0x07;
export const HID_CONSUMER_USAGE_PAGE = 0x0c;

export const HID_BASE_USAGE_MASK = 0x00ffffff;

/**
 * Category order is render order — the grid draws its sections in this
 * sequence — so this array is the one place that decides how far someone has
 * to scroll to reach a class of key.
 *
 * The consumer page sits in the middle rather than at the end. It used to be
 * one "Media" bucket sixth of seven, which put volume and playback below the
 * twenty-four function keys and made everything else on the page — brightness,
 * browser navigation, launchers — effectively unreachable. Those are outer-layer
 * keys: exactly what people build a layer *for*. Function keys past F12 are not.
 */
export const HID_ACTION_CATEGORY_IDS = [
  "letters",
  "numbers",
  "symbols",
  "navigation-editing",
  "media",
  "system",
  "browser-apps",
  "function",
  "modifiers",
] as const;

export type HidActionCategoryId = (typeof HID_ACTION_CATEGORY_IDS)[number];

export interface HidActionCategory {
  id: HidActionCategoryId;
  label: string;
  description: string;
  /**
   * The HID page every action in this category belongs to. Declared here so
   * callers that need to split the catalogue by page — the picker gives the
   * consumer categories a heading of their own — can derive the split instead
   * of keeping a second hand-maintained list in agreement with this one.
   */
  usagePage: number;
}

/**
 * Descriptions are user-facing *and* searchable: `matchesHidActionQuery` folds
 * a category's description into every one of its actions, so the words chosen
 * here are the words that find the whole group. "brightness", "launchers" and
 * "volume" each earn their place below for that reason.
 */
export const HID_ACTION_CATEGORIES: readonly HidActionCategory[] = [
  {
    id: "letters",
    label: "Letters",
    description: "Alphabet keys A through Z.",
    usagePage: HID_KEYBOARD_USAGE_PAGE,
  },
  {
    id: "numbers",
    label: "Numbers",
    description: "Number-row keys 0 through 9.",
    usagePage: HID_KEYBOARD_USAGE_PAGE,
  },
  {
    id: "symbols",
    label: "Symbols",
    description: "Punctuation and shifted symbol shortcuts.",
    usagePage: HID_KEYBOARD_USAGE_PAGE,
  },
  {
    id: "navigation-editing",
    label: "Navigation & editing",
    description: "Movement, editing, and common keyboard controls.",
    usagePage: HID_KEYBOARD_USAGE_PAGE,
  },
  {
    id: "media",
    label: "Media",
    description: "Playback transport, track skipping, and volume.",
    usagePage: HID_CONSUMER_USAGE_PAGE,
  },
  {
    id: "system",
    label: "System",
    description: "Display brightness, sleep, power, and screen lock.",
    usagePage: HID_CONSUMER_USAGE_PAGE,
  },
  {
    id: "browser-apps",
    label: "Browser & apps",
    description: "Browser navigation and application launchers.",
    usagePage: HID_CONSUMER_USAGE_PAGE,
  },
  {
    id: "function",
    label: "Function",
    description: "Function keys F1 through F24.",
    usagePage: HID_KEYBOARD_USAGE_PAGE,
  },
  {
    id: "modifiers",
    label: "Modifier keys",
    description: "Left and right Control, Shift, Alt, and GUI keys.",
    usagePage: HID_KEYBOARD_USAGE_PAGE,
  },
];

export const HID_ACTION_CATEGORY_BY_ID: Readonly<
  Record<HidActionCategoryId, HidActionCategory>
> = Object.fromEntries(
  HID_ACTION_CATEGORIES.map((category) => [category.id, category]),
) as Record<HidActionCategoryId, HidActionCategory>;

function categoryIdsForUsagePage(
  usagePage: number,
): readonly HidActionCategoryId[] {
  return HID_ACTION_CATEGORIES.filter(
    (category) => category.usagePage === usagePage,
  ).map(({ id }) => id);
}

/**
 * The two halves of the catalogue, in render order. Module constants rather
 * than inline literals because the grid memoises on the identity of the array
 * it is handed; a fresh literal per render would rebuild every section.
 */
export const HID_KEYBOARD_ACTION_CATEGORY_IDS = categoryIdsForUsagePage(
  HID_KEYBOARD_USAGE_PAGE,
);

export const HID_CONSUMER_ACTION_CATEGORY_IDS = categoryIdsForUsagePage(
  HID_CONSUMER_USAGE_PAGE,
);

export const HID_IMPLICIT_MODIFIER_MASKS = {
  leftControl: 0x01,
  leftShift: 0x02,
  leftAlt: 0x04,
  leftGui: 0x08,
  rightControl: 0x10,
  rightShift: 0x20,
  rightAlt: 0x40,
  rightGui: 0x80,
} as const;

export type HidImplicitModifierId = keyof typeof HID_IMPLICIT_MODIFIER_MASKS;

export interface HidImplicitModifier {
  id: HidImplicitModifierId;
  label: string;
  shortLabel: string;
  mask: number;
}

export const HID_IMPLICIT_MODIFIERS: readonly HidImplicitModifier[] = [
  {
    id: "leftControl",
    label: "Left Control",
    shortLabel: "L Ctrl",
    mask: HID_IMPLICIT_MODIFIER_MASKS.leftControl,
  },
  {
    id: "leftShift",
    label: "Left Shift",
    shortLabel: "L Shift",
    mask: HID_IMPLICIT_MODIFIER_MASKS.leftShift,
  },
  {
    id: "leftAlt",
    label: "Left Alt",
    shortLabel: "L Alt",
    mask: HID_IMPLICIT_MODIFIER_MASKS.leftAlt,
  },
  {
    id: "leftGui",
    label: "Left GUI",
    shortLabel: "L GUI",
    mask: HID_IMPLICIT_MODIFIER_MASKS.leftGui,
  },
  {
    id: "rightControl",
    label: "Right Control",
    shortLabel: "R Ctrl",
    mask: HID_IMPLICIT_MODIFIER_MASKS.rightControl,
  },
  {
    id: "rightShift",
    label: "Right Shift",
    shortLabel: "R Shift",
    mask: HID_IMPLICIT_MODIFIER_MASKS.rightShift,
  },
  {
    id: "rightAlt",
    label: "Right Alt",
    shortLabel: "R Alt",
    mask: HID_IMPLICIT_MODIFIER_MASKS.rightAlt,
  },
  {
    id: "rightGui",
    label: "Right GUI",
    shortLabel: "R GUI",
    mask: HID_IMPLICIT_MODIFIER_MASKS.rightGui,
  },
];

export interface HidActionCatalogItem {
  id: string;
  category: HidActionCategoryId;
  label: string;
  name: string;
  usagePage: number;
  usageId: number;
  baseUsage: number;
  modifierMask: number;
  usage: number;
  aliases: readonly string[];
}

interface CreateHidActionOptions {
  id: string;
  category: HidActionCategoryId;
  label: string;
  name: string;
  usageId: number;
  usagePage?: number;
  modifierMask?: number;
  aliases?: readonly string[];
}

export function getHidBaseUsage(usage: number): number {
  return usage & HID_BASE_USAGE_MASK;
}

export function getHidImplicitModifierMask(usage: number): number {
  return usage >>> 24;
}

export function withHidImplicitModifiers(
  usage: number,
  modifierMask: number,
): number {
  return (getHidBaseUsage(usage) | ((modifierMask & 0xff) << 24)) >>> 0;
}

function createHidAction({
  id,
  category,
  label,
  name,
  usageId,
  usagePage = HID_KEYBOARD_USAGE_PAGE,
  modifierMask = 0,
  aliases = [],
}: CreateHidActionOptions): HidActionCatalogItem {
  const baseUsage = hid_usage_from_page_and_id(usagePage, usageId);

  return {
    id,
    category,
    label,
    name,
    usagePage,
    usageId,
    baseUsage,
    modifierMask,
    usage: withHidImplicitModifiers(baseUsage, modifierMask),
    aliases,
  };
}

const letterActions: HidActionCatalogItem[] = Array.from(
  "QWERTYUIOPASDFGHJKLZXCVBNM",
  (letter) => {
    const alphabetIndex = letter.charCodeAt(0) - "A".charCodeAt(0);
    return createHidAction({
      id: `keyboard.letter.${letter.toLocaleLowerCase()}`,
      category: "letters",
      label: letter,
      name: `Keyboard ${letter}`,
      usageId: 0x04 + alphabetIndex,
      aliases: [letter.toLocaleLowerCase(), `letter ${letter}`],
    });
  },
);

const numberSpecs = [
  ["1", 0x1e],
  ["2", 0x1f],
  ["3", 0x20],
  ["4", 0x21],
  ["5", 0x22],
  ["6", 0x23],
  ["7", 0x24],
  ["8", 0x25],
  ["9", 0x26],
  ["0", 0x27],
] as const;

const numberActions: HidActionCatalogItem[] = numberSpecs.map(
  ([label, usageId]) =>
    createHidAction({
      id: `keyboard.number.${label}`,
      category: "numbers",
      label,
      name: `Keyboard number ${label}`,
      usageId,
      aliases: [`digit ${label}`, `number ${label}`],
    }),
);

const symbolActions: HidActionCatalogItem[] = [
  createHidAction({
    id: "keyboard.symbol.hyphen",
    category: "symbols",
    label: "-",
    name: "Hyphen",
    usageId: 0x2d,
    aliases: ["dash", "minus"],
  }),
  createHidAction({
    id: "keyboard.symbol.equals",
    category: "symbols",
    label: "=",
    name: "Equals",
    usageId: 0x2e,
    aliases: ["equal sign"],
  }),
  createHidAction({
    id: "keyboard.symbol.left-bracket",
    category: "symbols",
    label: "[",
    name: "Left bracket",
    usageId: 0x2f,
    aliases: ["open bracket", "square bracket"],
  }),
  createHidAction({
    id: "keyboard.symbol.right-bracket",
    category: "symbols",
    label: "]",
    name: "Right bracket",
    usageId: 0x30,
    aliases: ["close bracket", "square bracket"],
  }),
  createHidAction({
    id: "keyboard.symbol.backslash",
    category: "symbols",
    label: "\\",
    name: "Backslash",
    usageId: 0x31,
  }),
  createHidAction({
    id: "keyboard.symbol.semicolon",
    category: "symbols",
    label: ";",
    name: "Semicolon",
    usageId: 0x33,
  }),
  createHidAction({
    id: "keyboard.symbol.apostrophe",
    category: "symbols",
    label: "'",
    name: "Apostrophe",
    usageId: 0x34,
    aliases: ["single quote"],
  }),
  createHidAction({
    id: "keyboard.symbol.grave",
    category: "symbols",
    label: "`",
    name: "Grave accent",
    usageId: 0x35,
    aliases: ["backtick"],
  }),
  createHidAction({
    id: "keyboard.symbol.comma",
    category: "symbols",
    label: ",",
    name: "Comma",
    usageId: 0x36,
  }),
  createHidAction({
    id: "keyboard.symbol.period",
    category: "symbols",
    label: ".",
    name: "Period",
    usageId: 0x37,
    aliases: ["dot", "full stop"],
  }),
  createHidAction({
    id: "keyboard.symbol.slash",
    category: "symbols",
    label: "/",
    name: "Forward slash",
    usageId: 0x38,
    aliases: ["slash"],
  }),
  ...[
    ["exclamation", "!", "Exclamation mark", 0x1e, ["bang"]],
    ["at", "@", "At sign", 0x1f, ["at"]],
    ["hash", "#", "Hash", 0x20, ["number sign", "pound"]],
    ["dollar", "$", "Dollar sign", 0x21, ["currency"]],
    ["percent", "%", "Percent", 0x22, []],
    ["caret", "^", "Caret", 0x23, []],
    ["ampersand", "&", "Ampersand", 0x24, ["and sign"]],
    ["asterisk", "*", "Asterisk", 0x25, ["star"]],
    ["left-parenthesis", "(", "Left parenthesis", 0x26, ["open paren"]],
    ["right-parenthesis", ")", "Right parenthesis", 0x27, ["close paren"]],
    ["underscore", "_", "Underscore", 0x2d, []],
    ["plus", "+", "Plus", 0x2e, []],
    ["left-brace", "{", "Left brace", 0x2f, ["open brace"]],
    ["right-brace", "}", "Right brace", 0x30, ["close brace"]],
    ["pipe", "|", "Pipe", 0x31, ["vertical bar"]],
    ["colon", ":", "Colon", 0x33, []],
    ["double-quote", '"', "Double quote", 0x34, ["quotation mark"]],
    ["tilde", "~", "Tilde", 0x35, []],
    ["less-than", "<", "Less than", 0x36, ["angle bracket"]],
    ["greater-than", ">", "Greater than", 0x37, ["angle bracket"]],
    ["question", "?", "Question mark", 0x38, []],
  ].map(([id, label, name, usageId, aliases]) =>
    createHidAction({
      id: `keyboard.symbol.${id as string}`,
      category: "symbols",
      label: label as string,
      name: name as string,
      usageId: usageId as number,
      modifierMask: HID_IMPLICIT_MODIFIER_MASKS.leftShift,
      aliases: aliases as string[],
    }),
  ),
];

const navigationAndEditingActions: HidActionCatalogItem[] = [
  ["escape", "Esc", "Escape", 0x29, ["cancel"]],
  ["tab", "Tab", "Tab", 0x2b, []],
  ["space", "Space", "Spacebar", 0x2c, ["blank"]],
  ["enter", "Enter", "Enter", 0x28, ["return"]],
  ["backspace", "Back", "Backspace", 0x2a, ["delete backward"]],
  ["insert", "Ins", "Insert", 0x49, []],
  ["delete", "Del", "Delete forward", 0x4c, ["delete"]],
  ["home", "Home", "Home", 0x4a, []],
  ["end", "End", "End", 0x4d, []],
  ["page-up", "PgUp", "Page up", 0x4b, []],
  ["page-down", "PgDn", "Page down", 0x4e, []],
  ["arrow-left", "←", "Left arrow", 0x50, ["left"]],
  ["arrow-right", "→", "Right arrow", 0x4f, ["right"]],
  ["arrow-up", "↑", "Up arrow", 0x52, ["up"]],
  ["arrow-down", "↓", "Down arrow", 0x51, ["down"]],
  ["caps-lock", "Caps", "Caps Lock", 0x39, []],
  ["print-screen", "PrtSc", "Print Screen", 0x46, ["screenshot"]],
  ["scroll-lock", "ScrLk", "Scroll Lock", 0x47, []],
  ["pause", "Pause", "Pause", 0x48, ["break"]],
  ["application", "Menu", "Application menu", 0x65, ["context menu"]],
  ["undo", "Undo", "Undo", 0x7a, []],
  ["cut", "Cut", "Cut", 0x7b, []],
  ["copy", "Copy", "Copy", 0x7c, []],
  ["paste", "Paste", "Paste", 0x7d, []],
  ["find", "Find", "Find", 0x7e, ["search"]],
].map(([id, label, name, usageId, aliases]) =>
  createHidAction({
    id: `keyboard.navigation.${id as string}`,
    category: "navigation-editing",
    label: label as string,
    name: name as string,
    usageId: usageId as number,
    aliases: aliases as string[],
  }),
);

const functionActions: HidActionCatalogItem[] = Array.from(
  { length: 24 },
  (_, index) => {
    const functionNumber = index + 1;
    return createHidAction({
      id: `keyboard.function.f${functionNumber}`,
      category: "function",
      label: `F${functionNumber}`,
      name: `Function key F${functionNumber}`,
      usageId: index < 12 ? 0x3a + index : 0x68 + (index - 12),
      aliases: [`function ${functionNumber}`],
    });
  },
);

/*
 * Consumer page (0x0C), split three ways.
 *
 * `&kp` takes a consumer usage as happily as a keyboard one, and these are the
 * keys an outer layer is usually built to hold. Every usage ID below was read
 * out of `src/keyboard-and-consumer-usage-tables.json` — the same table the app
 * resolves labels from — rather than written from memory, because a wrong ID
 * here is silent: the binding applies, the firmware accepts it, and the owner
 * finds out only when the key does the wrong thing. ZMK's `keys.h` decided
 * *which* of the 450 consumer usages are worth shipping; the table decided what
 * number each one is.
 *
 * The split is by what someone is reaching for, not by where the numbers fall:
 * transport and volume, host state, then the browser and launcher keys. One
 * bucket of thirty-four would have been a longer list, not a more findable one.
 */

const mediaActions: HidActionCatalogItem[] = [
  ["play-pause", "Play/Pause", "Play or pause", 0xcd, ["media toggle"]],
  ["play", "Play", "Play", 0xb0, []],
  ["pause", "Pause", "Pause", 0xb1, []],
  ["stop", "Stop", "Stop playback", 0xb7, []],
  ["previous", "Previous", "Previous track", 0xb6, ["previous song"]],
  ["next", "Next", "Next track", 0xb5, ["next song"]],
  ["rewind", "Rewind", "Rewind", 0xb4, []],
  ["fast-forward", "Forward", "Fast forward", 0xb3, []],
  ["record", "Record", "Record", 0xb2, []],
  ["shuffle", "Shuffle", "Random play", 0xb9, ["random"]],
  ["eject", "Eject", "Eject", 0xb8, []],
  ["mute", "Mute", "Mute volume", 0xe2, ["sound off"]],
  ["volume-up", "Vol +", "Volume up", 0xe9, ["louder"]],
  ["volume-down", "Vol −", "Volume down", 0xea, ["quieter"]],
].map(([id, label, name, usageId, aliases]) =>
  createHidAction({
    id: `consumer.media.${id as string}`,
    category: "media",
    label: label as string,
    name: name as string,
    usagePage: HID_CONSUMER_USAGE_PAGE,
    usageId: usageId as number,
    aliases: aliases as string[],
  }),
);

/*
 * Host state. Brightness is the reason this category exists — it is the one
 * laptop key a custom board cannot otherwise reproduce — and lock, sleep and
 * power sit with it because they are all "do something to the machine" rather
 * than "type something into it".
 *
 * Deliberately absent: keyboard-backlight brightness (0x79/0x7A). Those control
 * the *host's* keyboard illumination, which in a keyboard configurator sitting
 * next to ZMK's own backlight behaviour would read as the same thing and is not.
 */
const systemActions: HidActionCatalogItem[] = [
  ["brightness-up", "Bri +", "Display brightness up", 0x6f, ["brighter"]],
  ["brightness-down", "Bri −", "Display brightness down", 0x70, ["dimmer"]],
  ["brightness-max", "Bri max", "Display brightness maximum", 0x74, []],
  ["brightness-min", "Bri min", "Display brightness minimum", 0x73, []],
  [
    "brightness-auto",
    "Bri auto",
    "Automatic display brightness",
    0x75,
    ["adaptive brightness"],
  ],
  [
    "lock",
    "Lock",
    "Lock screen",
    0x19e,
    ["screensaver", "terminal lock", "lock workstation"],
  ],
  ["sleep", "Sleep", "Sleep", 0x32, ["suspend", "standby"]],
  ["power", "Power", "Power", 0x30, ["shut down", "power off"]],
].map(([id, label, name, usageId, aliases]) =>
  createHidAction({
    id: `consumer.system.${id as string}`,
    category: "system",
    label: label as string,
    name: name as string,
    usagePage: HID_CONSUMER_USAGE_PAGE,
    usageId: usageId as number,
    aliases: aliases as string[],
  }),
);

/*
 * Application Control (AC) — what the focused application should do. Every name
 * carries "Browser" because the labels alone collide with keys that already
 * exist elsewhere in the grid: Backspace is labelled "Back", Navigation has its
 * own Home and Search. The tooltip and the canvas both read the name.
 */
const browserActions: HidActionCatalogItem[] = [
  ["back", "Back", "Browser back", 0x224, ["previous page", "go back"]],
  ["forward", "Fwd", "Browser forward", 0x225, ["next page", "go forward"]],
  ["refresh", "Reload", "Browser refresh", 0x227, ["reload page"]],
  ["home", "Homepage", "Browser home", 0x223, ["start page"]],
  ["search", "Search", "Browser search", 0x221, ["find on page"]],
  [
    "bookmarks",
    "Bookmarks",
    "Browser bookmarks",
    0x22a,
    ["favorites", "favourites"],
  ],
].map(([id, label, name, usageId, aliases]) =>
  createHidAction({
    id: `consumer.browser.${id as string}`,
    category: "browser-apps",
    label: label as string,
    name: name as string,
    usagePage: HID_CONSUMER_USAGE_PAGE,
    usageId: usageId as number,
    aliases: aliases as string[],
  }),
);

/*
 * Application Launch (AL) — open a program. The two file usages are both
 * shipped, and named apart, because the page genuinely has two: 0x194 is the
 * "My Computer" key found on media keyboards, 0x1B4 is the file browser proper.
 * Hosts do not agree on which they honour, so guessing one and hiding the other
 * would leave whoever needed the other with nothing.
 */
const launcherActions: HidActionCatalogItem[] = [
  ["browser", "Web", "Web browser", 0x196, ["internet browser", "launch web"]],
  ["mail", "Mail", "Email client", 0x18a, ["email reader", "inbox"]],
  ["calculator", "Calc", "Calculator", 0x192, ["calc"]],
  [
    "files",
    "Files",
    "File browser",
    0x1b4,
    ["explorer", "finder", "file manager"],
  ],
  [
    "computer",
    "Computer",
    "My computer",
    0x194,
    ["local machine browser", "this pc"],
  ],
  [
    "control-panel",
    "Settings",
    "Control panel",
    0x19f,
    ["system settings", "preferences"],
  ],
].map(([id, label, name, usageId, aliases]) =>
  createHidAction({
    id: `consumer.launcher.${id as string}`,
    category: "browser-apps",
    label: label as string,
    name: name as string,
    usagePage: HID_CONSUMER_USAGE_PAGE,
    usageId: usageId as number,
    aliases: aliases as string[],
  }),
);

const modifierActions: HidActionCatalogItem[] = [
  ["left-control", "L Ctrl", "Left Control", 0xe0, ["ctrl", "control"]],
  ["left-shift", "L Shift", "Left Shift", 0xe1, ["shift"]],
  ["left-alt", "L Alt", "Left Alt", 0xe2, ["alt", "option"]],
  ["left-gui", "L GUI", "Left GUI", 0xe3, ["command", "cmd", "windows"]],
  ["right-control", "R Ctrl", "Right Control", 0xe4, ["ctrl", "control"]],
  ["right-shift", "R Shift", "Right Shift", 0xe5, ["shift"]],
  ["right-alt", "R Alt", "Right Alt", 0xe6, ["alt gr", "option"]],
  ["right-gui", "R GUI", "Right GUI", 0xe7, ["command", "cmd", "windows"]],
].map(([id, label, name, usageId, aliases]) =>
  createHidAction({
    id: `keyboard.modifier.${id as string}`,
    category: "modifiers",
    label: label as string,
    name: name as string,
    usageId: usageId as number,
    aliases: aliases as string[],
  }),
);

export const HID_ACTION_CATALOG: readonly HidActionCatalogItem[] = [
  ...letterActions,
  ...numberActions,
  ...symbolActions,
  ...navigationAndEditingActions,
  ...mediaActions,
  ...systemActions,
  ...browserActions,
  ...launcherActions,
  ...functionActions,
  ...modifierActions,
];

function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function matchesHidActionQuery(
  action: HidActionCatalogItem,
  query: string,
): boolean {
  const rawQuery = query.trim().toLocaleLowerCase();
  if (!rawQuery) return true;

  const category = HID_ACTION_CATEGORY_BY_ID[action.category];
  const searchableValues = [
    action.id,
    action.label,
    action.name,
    category.label,
    /*
     * The category description is searched too, so a word that describes a
     * whole class finds the whole class without every member repeating it in
     * its own aliases. "brightness" reaches all five brightness usages,
     * "launcher" reaches all six launchers, "volume" reaches the media group.
     * Aliases stay for the per-action synonyms a description cannot carry —
     * "finder", "favourites", "this pc".
     */
    category.description,
    ...action.aliases,
    action.usagePage === HID_KEYBOARD_USAGE_PAGE
      ? "keyboard key"
      : "consumer control",
    `0x${action.usagePage.toString(16)} 0x${action.usageId.toString(16)}`,
  ];

  if (
    searchableValues.some((value) =>
      value.toLocaleLowerCase().includes(rawQuery),
    )
  ) {
    return true;
  }

  const tokens = normalizeSearchText(rawQuery).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  const normalizedHaystack = normalizeSearchText(searchableValues.join(" "));
  return tokens.every((token) => normalizedHaystack.includes(token));
}

export function searchHidActionCatalog(
  query: string,
  catalog: readonly HidActionCatalogItem[] = HID_ACTION_CATALOG,
): HidActionCatalogItem[] {
  return catalog.filter((action) => matchesHidActionQuery(action, query));
}

export interface HidUsagePageRange {
  id: number;
  min?: number;
  max?: number;
}

export function isHidActionWithinUsagePages(
  action: HidActionCatalogItem,
  usagePages: readonly HidUsagePageRange[],
): boolean {
  const page = usagePages.find(({ id }) => id === action.usagePage);
  if (!page) return false;

  return (
    action.usageId >= (page.min ?? 0) &&
    action.usageId <= (page.max ?? Number.MAX_SAFE_INTEGER)
  );
}

export function filterHidActionCatalogForUsagePages(
  usagePages: readonly HidUsagePageRange[],
  catalog: readonly HidActionCatalogItem[] = HID_ACTION_CATALOG,
): HidActionCatalogItem[] {
  return catalog.filter((action) =>
    isHidActionWithinUsagePages(action, usagePages),
  );
}

function countBits(value: number): number {
  let remaining = value & 0xff;
  let count = 0;

  while (remaining) {
    count += remaining & 1;
    remaining >>>= 1;
  }

  return count;
}

export function findHidActionForUsage(
  usage: number,
  catalog: readonly HidActionCatalogItem[] = HID_ACTION_CATALOG,
): HidActionCatalogItem | undefined {
  const normalizedUsage = usage >>> 0;
  const exact = catalog.find((action) => action.usage === normalizedUsage);
  if (exact) return exact;

  const baseUsage = getHidBaseUsage(normalizedUsage);
  const modifierMask = getHidImplicitModifierMask(normalizedUsage);

  return catalog
    .filter(
      (action) =>
        action.baseUsage === baseUsage &&
        (action.modifierMask & modifierMask) === action.modifierMask,
    )
    .sort(
      (left, right) =>
        countBits(right.modifierMask) - countBits(left.modifierMask),
    )[0];
}

export function describeHidUsage(
  usage: number,
  catalog: readonly HidActionCatalogItem[] = HID_ACTION_CATALOG,
): string {
  const normalizedUsage = usage >>> 0;
  const action = findHidActionForUsage(normalizedUsage, catalog);
  const modifierMask = getHidImplicitModifierMask(normalizedUsage);
  const remainingModifiers = action
    ? modifierMask & ~action.modifierMask
    : modifierMask;
  const modifierLabels = HID_IMPLICIT_MODIFIERS.filter(
    ({ mask }) => (remainingModifiers & mask) === mask,
  ).map(({ shortLabel }) => shortLabel);

  const baseLabel = (() => {
    if (action) return action.name;

    const [page, id] = hid_usage_page_and_id_from_usage(
      getHidBaseUsage(normalizedUsage),
    );
    return hid_usage_get_label(page, id) || `Usage ${page}:${id}`;
  })();

  return [...modifierLabels, baseLabel].join(" + ");
}
