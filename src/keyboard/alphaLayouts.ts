/**
 * Alpha-block starter layouts.
 *
 * Deliberately *only* the alphas. Whole layout systems of the Miryoku class are
 * off the table — see `LAYOUTS.md` §5 — because they are built on home row mods
 * whose behaviour is decided by `tapping-term-ms`, `require-prior-idle-ms`,
 * `flavor` and positional hold-tap, none of which the Studio protocol exposes.
 * Writing those bindings would hand someone a keyboard that misfires with the
 * remedy in a file this app cannot reach. Swapping which letter sits on which
 * key is plain `&kp` with no timing coupling at all.
 *
 * ── How the block is identified ─────────────────────────────────────────────
 *
 * Not by geometry. Guessing which keys form "the alpha block" on a board you
 * have never seen goes wrong on exactly the boards people buy this kind of tool
 * for. Instead the current layer is *read*: every key bound to a plain letter
 * is collected in reading order, and if that sequence matches a layout we know,
 * we know the mapping precisely — position by position, with no assumption
 * about rows, columns, or where the block starts.
 *
 * If the sequence matches nothing, the feature declines. A board mid-edit, or
 * on a layout not listed here, gets no offer rather than a scrambled keymap.
 */

export interface AlphaLayout {
  id: string;
  name: string;
  /** Three rows of ten, in the order a standard block reads. */
  rows: readonly [string, string, string];
}

/**
 * Only layouts whose exact grid is certain. A wrong row here silently
 * scrambles someone's board, which is far worse than the layout being absent —
 * so adding one is a data-only change that must be checked against that
 * layout's own reference, not from memory.
 */
export const ALPHA_LAYOUTS: readonly AlphaLayout[] = [
  {
    id: "qwerty",
    name: "QWERTY",
    rows: ["qwertyuiop", "asdfghjkl;", "zxcvbnm,./"],
  },
  {
    id: "colemak",
    name: "Colemak",
    rows: ["qwfpgjluy;", "arstdhneio", "zxcvbkm,./"],
  },
  {
    id: "colemak-dh",
    name: "Colemak-DH",
    rows: ["qwfpbjluy;", "arstgmneio", "zxcdvkh,./"],
  },
  {
    id: "dvorak",
    name: "Dvorak",
    rows: ["',.pyfgcrl", "aoeuidhtns", ";qjkxbmwvz"],
  },
  {
    id: "workman",
    name: "Workman",
    rows: ["qdrwbjfup;", "ashtgyneoi", "zxmcvkl,./"],
  },
];

/** HID Keyboard/Keypad usage IDs for a…z are 0x04…0x1D. */
const LETTER_USAGE_FIRST = 0x04;
const LETTER_USAGE_LAST = 0x1d;

export function letterForUsageId(usageId: number): string | undefined {
  if (usageId < LETTER_USAGE_FIRST || usageId > LETTER_USAGE_LAST) {
    return undefined;
  }
  return String.fromCharCode(97 + (usageId - LETTER_USAGE_FIRST));
}

export function usageIdForLetter(letter: string): number | undefined {
  const code = letter.toLowerCase().charCodeAt(0) - 97;
  if (code < 0 || code > 25) return undefined;
  return LETTER_USAGE_FIRST + code;
}

/** The letters of a layout, in reading order, punctuation dropped. */
export function lettersOf(layout: AlphaLayout): string {
  return layout.rows.join("").replace(/[^a-z]/g, "");
}

/**
 * Which layout the given letter sequence is, if any.
 *
 * Compared as a whole sequence rather than key by key, so a board halfway
 * through being retyped matches nothing and is left alone.
 */
export function detectAlphaLayout(letters: string): AlphaLayout | undefined {
  return ALPHA_LAYOUTS.find((layout) => lettersOf(layout) === letters);
}

/**
 * The letter each position should carry after switching layouts.
 *
 * `positions` must be the letter-bearing key positions in the same reading
 * order the sequence was collected in — position *i* currently holds the
 * source layout's *i*th letter, so it takes the target layout's *i*th letter.
 */
export function remapAlphas(
  positions: readonly number[],
  from: AlphaLayout,
  to: AlphaLayout,
): Map<number, string> {
  const source = lettersOf(from);
  const target = lettersOf(to);
  const result = new Map<number, string>();

  if (source.length !== target.length) return result;

  positions.forEach((position, index) => {
    const letter = target[index];
    if (letter && letter !== source[index]) result.set(position, letter);
  });

  return result;
}
