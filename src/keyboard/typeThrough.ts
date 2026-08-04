import type { PhysicalLayout } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import {
  HID_KEYBOARD_USAGE_PAGE,
  HID_CONSUMER_USAGE_PAGE,
} from "../behaviors/actionCatalog";
import { hid_usage_from_page_and_id } from "../hid-usages";

/**
 * Type-through binding — press the key you want the key to become.
 *
 * A 42-key split with four layers is 168 bindings. Clicking a key, reading a
 * list, finding an action and clicking it costs around four seconds when you
 * already know what you want, which puts a full board at roughly two hours.
 * That is the number that sends people back to editing a `.keymap` by hand,
 * where a base layer is thirty seconds of typing.
 *
 * This makes it thirty seconds of typing. The application is running on a
 * keyboard; asking someone to hunt for `A` in a searchable list while their
 * finger is resting on `A` is the central absurdity of every configurator, and
 * it costs almost nothing to remove.
 *
 * This module is the pure half — a keycode table and a traversal order — so it
 * can be reasoned about and tested without a React tree or a live keyboard.
 */

/**
 * `KeyboardEvent.code` → HID Keyboard/Keypad (0x07) usage ID.
 *
 * Keyed on `code` rather than `key` deliberately: `code` is the physical
 * position and does not change with the host's active layout, so a user typing
 * on a host set to AZERTY still binds the key they physically pressed rather
 * than the letter their OS produced.
 */
const KEYBOARD_USAGE_BY_CODE: Readonly<Record<string, number>> = {
  ...Object.fromEntries(
    Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ", (letter, index) => [
      `Key${letter}`,
      0x04 + index,
    ]),
  ),
  ...Object.fromEntries(
    Array.from({ length: 9 }, (_, index) => [
      `Digit${index + 1}`,
      0x1e + index,
    ]),
  ),
  Digit0: 0x27,

  Enter: 0x28,
  Escape: 0x29,
  Backspace: 0x2a,
  Tab: 0x2b,
  Space: 0x2c,
  Minus: 0x2d,
  Equal: 0x2e,
  BracketLeft: 0x2f,
  BracketRight: 0x30,
  Backslash: 0x31,
  Semicolon: 0x33,
  Quote: 0x34,
  Backquote: 0x35,
  Comma: 0x36,
  Period: 0x37,
  Slash: 0x38,
  CapsLock: 0x39,

  ...Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => [`F${index + 1}`, 0x3a + index]),
  ),

  PrintScreen: 0x46,
  ScrollLock: 0x47,
  Pause: 0x48,
  Insert: 0x49,
  Home: 0x4a,
  PageUp: 0x4b,
  Delete: 0x4c,
  End: 0x4d,
  PageDown: 0x4e,
  ArrowRight: 0x4f,
  ArrowLeft: 0x50,
  ArrowDown: 0x51,
  ArrowUp: 0x52,

  NumLock: 0x53,
  NumpadDivide: 0x54,
  NumpadMultiply: 0x55,
  NumpadSubtract: 0x56,
  NumpadAdd: 0x57,
  NumpadEnter: 0x58,
  ...Object.fromEntries(
    Array.from({ length: 9 }, (_, index) => [
      `Numpad${index + 1}`,
      0x59 + index,
    ]),
  ),
  Numpad0: 0x62,
  NumpadDecimal: 0x63,
  IntlBackslash: 0x64,
  ContextMenu: 0x65,
  NumpadEqual: 0x67,

  ...Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => [`F${index + 13}`, 0x68 + index]),
  ),

  IntlRo: 0x87,
  IntlYen: 0x89,
  Convert: 0x8a,
  NonConvert: 0x8b,

  ControlLeft: 0xe0,
  ShiftLeft: 0xe1,
  AltLeft: 0xe2,
  MetaLeft: 0xe3,
  ControlRight: 0xe4,
  ShiftRight: 0xe5,
  AltRight: 0xe6,
  MetaRight: 0xe7,
};

/** Media keys the browser reports but the keyboard page cannot express. */
const CONSUMER_USAGE_BY_CODE: Readonly<Record<string, number>> = {
  AudioVolumeUp: 0xe9,
  AudioVolumeDown: 0xea,
  AudioVolumeMute: 0xe2,
  MediaPlayPause: 0xcd,
  MediaStop: 0xb7,
  MediaTrackNext: 0xb5,
  MediaTrackPrevious: 0xb6,
};

/** Codes that are themselves a modifier, so pressing one alone is a binding. */
const MODIFIER_CODES = new Set([
  "ControlLeft",
  "ShiftLeft",
  "AltLeft",
  "MetaLeft",
  "ControlRight",
  "ShiftRight",
  "AltRight",
  "MetaRight",
]);

export function isModifierCode(code: string): boolean {
  return MODIFIER_CODES.has(code);
}

/**
 * The HID usage a physical key press should bind to, or undefined when the
 * code is not something this keyboard page can express.
 */
export function usageForCode(code: string): number | undefined {
  const keyboardId = KEYBOARD_USAGE_BY_CODE[code];
  if (keyboardId !== undefined) {
    return hid_usage_from_page_and_id(HID_KEYBOARD_USAGE_PAGE, keyboardId);
  }

  const consumerId = CONSUMER_USAGE_BY_CODE[code];
  if (consumerId !== undefined) {
    return hid_usage_from_page_and_id(HID_CONSUMER_USAGE_PAGE, consumerId);
  }

  return undefined;
}

/**
 * Key positions in reading order: rows top to bottom, then left to right.
 *
 * Not array order. A physical layout's binding array is in whatever order the
 * firmware's devicetree happened to declare, which on split boards routinely
 * interleaves the halves. Advancing through that order would send the cursor
 * jumping across the gap between every key, and the whole point of the mode is
 * that the cursor goes where your eye expects.
 *
 * Rows are found by clustering on y rather than by exact equality, because
 * columnar-stagger boards give every column a different y and no two keys in a
 * "row" share one. The tolerance is half a key height.
 */
export function readingOrder(layout: PhysicalLayout): number[] {
  const keys = layout.keys.map((key, index) => ({
    index,
    x: key.x,
    y: key.y,
    height: key.height || 100,
  }));

  if (keys.length === 0) return [];

  const tolerance =
    keys.reduce((total, key) => total + key.height, 0) / keys.length / 2;

  const byY = [...keys].sort((left, right) => left.y - right.y);
  const rows: (typeof byY)[] = [];

  for (const key of byY) {
    const row = rows[rows.length - 1];
    // Compare against the row's first key, not the previous key: comparing
    // pairwise lets a long column-staggered row drift into the next one.
    if (row && Math.abs(key.y - row[0].y) <= tolerance) {
      row.push(key);
    } else {
      rows.push([key]);
    }
  }

  return rows.flatMap((row) =>
    [...row].sort((left, right) => left.x - right.x).map(({ index }) => index),
  );
}

/**
 * Step through the reading order, stopping at both ends.
 *
 * Deliberately does not wrap. Reaching the last key means the board is done,
 * and silently restarting at the top would let a distracted user overwrite the
 * work they just finished.
 */
export function stepPosition(
  order: number[],
  current: number | undefined,
  direction: 1 | -1,
): number | undefined {
  if (order.length === 0) return undefined;
  if (current === undefined) return order[0];

  const at = order.indexOf(current);
  if (at === -1) return order[0];

  const next = at + direction;
  if (next < 0 || next >= order.length) return undefined;
  return order[next];
}
