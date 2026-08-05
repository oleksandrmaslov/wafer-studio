import { createContext, useCallback, useContext, useEffect } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * The command registry.
 *
 * Commands are registered by whichever component owns the action, not declared
 * centrally. That matters because the actions worth putting in a palette live
 * in three different places — layer operations inside `Keyboard`, connection
 * and firmware operations inside `AppHeader`, appearance at the app root — and
 * a central list would need all three to hand their callbacks upward just to be
 * listed. Registration keeps each action next to the state it mutates.
 *
 * The palette is also where rare-but-real actions go so the rails can stay
 * small. Anything that would otherwise earn a permanent button by being
 * occasionally necessary belongs here instead.
 */

export interface Command {
  /** Stable across renders; used as the React key and for de-duplication. */
  id: string;
  label: string;
  /** Grouping header in the palette. */
  section: string;
  icon?: LucideIcon;
  /** Extra words to match on, for things users call by another name. */
  keywords?: string;
  /** Shown right-aligned — a shortcut, or a short consequence. */
  hint?: string;
  /**
   * Destructive actions are sorted last, styled as danger, and require a
   * second confirming press. `resetSettings` sat two rows from "About" in a
   * convenience menu before this existed.
   */
  destructive?: boolean;
  disabled?: boolean;
  run: () => void;
}

export interface CommandRegistry {
  register: (commands: Command[]) => () => void;
  /** Open the palette from a button, for anyone who has not met ⌘K. */
  open: () => void;
}

export const CommandContext = createContext<CommandRegistry | null>(null);

/**
 * Register commands for as long as the calling component is mounted.
 *
 * `commands` is read on every change, so callers should memoise it — otherwise
 * every parent render re-registers. The dependency is the array identity, which
 * makes that requirement visible rather than silent.
 */
/**
 * Opens the palette.
 *
 * A shortcut nobody has been told about is not a feature, so the rail carries a
 * visible way in and this is what it calls.
 */
export function useCommandPalette(): () => void {
  const registry = useContext(CommandContext);
  return useCallback(() => registry?.open(), [registry]);
}

export function useCommands(commands: Command[]): void {
  const registry = useContext(CommandContext);

  useEffect(() => {
    if (!registry) return;
    return registry.register(commands);
  }, [registry, commands]);
}
