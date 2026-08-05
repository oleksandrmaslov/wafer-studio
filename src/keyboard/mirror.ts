import type { PhysicalLayout } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import {
  HID_KEYBOARD_USAGE_PAGE,
  getHidBaseUsage,
  getHidImplicitModifierMask,
  withHidImplicitModifiers,
} from "../behaviors/actionCatalog";
import {
  hid_usage_from_page_and_id,
  hid_usage_page_and_id_from_usage,
} from "../hid-usages";

/**
 * Mirroring a key to its opposite number.
 *
 * Deliberately *not* "mirror the left half onto the right half". On any real
 * base layer the halves hold different letters — QWERT on one side, YUIOP on
 * the other — so copying one onto the other destroys the layer. Whole-half
 * mirroring is a feature that sounds useful and is almost never correct.
 *
 * What is genuinely symmetric is a handful of keys: home-row mods, thumb
 * clusters, layer keys, the modifier row. Those are the ones worth mirroring,
 * one at a time, on purpose.
 *
 * And for exactly those keys a copy is still wrong, because the mirror of
 * Left Shift is Right Shift. So mirroring flips modifier handedness in both
 * places ZMK encodes it — as a usage in its own right, and as the implicit
 * modifier mask carried in the top byte of a usage.
 */

/** Left-hand modifier usage IDs are 0xE0–0xE3; their right twins are +4. */
const MODIFIER_USAGE_FIRST_LEFT = 0xe0;
const MODIFIER_USAGE_LAST_LEFT = 0xe3;
const MODIFIER_USAGE_FIRST_RIGHT = 0xe4;
const MODIFIER_USAGE_LAST_RIGHT = 0xe7;
const MODIFIER_SIDE_STRIDE = 4;

/** Implicit modifier masks: low nibble is left-hand, high nibble is right. */
const IMPLICIT_LEFT_NIBBLE = 0x0f;
const IMPLICIT_RIGHT_NIBBLE = 0xf0;

/**
 * The same usage with its handedness flipped. Anything that is not
 * side-specific comes back unchanged.
 */
export function mirrorUsage(usage: number): number {
  const base = getHidBaseUsage(usage);
  const [page, id] = hid_usage_page_and_id_from_usage(base);

  let mirroredId = id;
  if (page === HID_KEYBOARD_USAGE_PAGE) {
    if (id >= MODIFIER_USAGE_FIRST_LEFT && id <= MODIFIER_USAGE_LAST_LEFT) {
      mirroredId = id + MODIFIER_SIDE_STRIDE;
    } else if (
      id >= MODIFIER_USAGE_FIRST_RIGHT &&
      id <= MODIFIER_USAGE_LAST_RIGHT
    ) {
      mirroredId = id - MODIFIER_SIDE_STRIDE;
    }
  }

  const mask = getHidImplicitModifierMask(usage);
  const mirroredMask =
    ((mask & IMPLICIT_LEFT_NIBBLE) << 4) |
    ((mask & IMPLICIT_RIGHT_NIBBLE) >>> 4);

  return withHidImplicitModifiers(
    hid_usage_from_page_and_id(page, mirroredId),
    mirroredMask,
  );
}

/**
 * The key opposite this one, reflected across the board's vertical centre.
 *
 * Returns undefined when nothing sits opposite — a centre column on an odd
 * board, a thumb key with no twin, an asymmetric layout. That is a real answer
 * and the caller should disable the action rather than guess: silently binding
 * the "nearest" key on a board with no symmetry would scribble on something the
 * user never looked at.
 */
export function mirrorPosition(
  layout: PhysicalLayout,
  index: number,
): number | undefined {
  const keys = layout.keys;
  const key = keys[index];
  if (!key) return undefined;

  const centreX = (k: (typeof keys)[number]) => k.x + (k.width || 100) / 2;
  const centreY = (k: (typeof keys)[number]) => k.y + (k.height || 100) / 2;

  const left = Math.min(...keys.map((k) => k.x));
  const right = Math.max(...keys.map((k) => k.x + (k.width || 100)));
  const axis = (left + right) / 2;

  const wantX = 2 * axis - centreX(key);
  const wantY = centreY(key);

  let best: number | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  keys.forEach((candidate, candidateIndex) => {
    if (candidateIndex === index) return;
    const dx = centreX(candidate) - wantX;
    const dy = centreY(candidate) - wantY;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidateIndex;
    }
  });

  // Within about half a key of where the reflection landed. Loose enough for
  // the row stagger between two halves, tight enough to refuse a board that is
  // not symmetric at all.
  const tolerance = (key.width || 100) * 0.6;
  return bestDistance <= tolerance * tolerance ? best : undefined;
}
