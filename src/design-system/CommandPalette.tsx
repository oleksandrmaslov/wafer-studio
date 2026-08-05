import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Search } from "lucide-react";
import {
  CommandContext,
  type Command,
  type CommandRegistry,
} from "./commandRegistry.ts";

/**
 * ⌘K. Every rare action, one keystroke away.
 *
 * The rails can only stay small if the things left out of them are still fast
 * to reach. This is that escape hatch, and it is also where destructive actions
 * live — out of the convenience menus where a mis-click costs you a keyboard.
 *
 * Destructive commands sort last, are styled as danger, and take two presses:
 * the first arms, the second runs. That is deliberately weaker than a typed
 * confirmation and deliberately stronger than a menu row, because the palette
 * is driven by muscle memory and muscle memory is exactly what fires an
 * unintended `resetSettings`.
 */

function score(command: Command, query: string): number {
  if (!query) return 0;
  const haystack =
    `${command.label} ${command.section} ${command.keywords ?? ""}`.toLowerCase();
  const index = haystack.indexOf(query);
  if (index === -1) return -1;
  // Prefer matches at a word boundary, then earlier ones.
  return (index === 0 || haystack[index - 1] === " " ? 0 : 100) + index;
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [registered, setRegistered] = useState<Command[][]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [armed, setArmed] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const registry = useMemo<CommandRegistry>(
    () => ({
      register: (commands) => {
        setRegistered((current) => [...current, commands]);
        return () =>
          setRegistered((current) => current.filter((c) => c !== commands));
      },
    }),
    [],
  );

  const commands = useMemo(() => {
    const seen = new Set<string>();
    return registered
      .flat()
      .filter((command) => {
        if (seen.has(command.id)) return false;
        seen.add(command.id);
        return true;
      })
      .sort((a, b) => Number(a.destructive ?? false) - Number(b.destructive ?? false));
  }, [registered]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return commands
      .map((command) => ({ command, rank: score(command, needle) }))
      .filter(({ rank }) => rank !== -1)
      .sort((a, b) => a.rank - b.rank)
      .map(({ command }) => command);
  }, [commands, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setArmed(null);
    const target = restoreRef.current;
    restoreRef.current = null;
    if (target?.isConnected) target.focus();
  }, []);

  // ⌘K / Ctrl+K from anywhere, including from inside a text field — the whole
  // point is that it does not matter where you are.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => {
          if (!current) restoreRef.current = document.activeElement as HTMLElement;
          return !current;
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setActive(0);
    setArmed(null);
  }, [query]);

  const run = useCallback(
    (command: Command) => {
      if (command.disabled) return;
      if (command.destructive && armed !== command.id) {
        setArmed(command.id);
        return;
      }
      close();
      command.run();
    },
    [armed, close],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = results[active];
      if (command) run(command);
    }
  };

  let lastSection: string | undefined;

  return (
    <CommandContext.Provider value={registry}>
      {children}

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-start justify-center bg-[rgb(var(--light-shadow)/0.45)] pt-[12vh] backdrop-blur-sm"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onKeyDown={onKeyDown}
            className="wafer-float flex max-h-[min(28rem,70vh)] w-[min(34rem,calc(100vw-2rem))] flex-col overflow-hidden"
          >
            <div className="flex items-center gap-2 border-b border-line-subtle px-3">
              <Search aria-hidden="true" className="size-4 shrink-0 text-tertiary" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Search commands…"
                aria-label="Search commands"
                className="min-h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-tertiary"
              />
              <kbd className="rounded border border-line-subtle px-1.5 py-0.5 font-mono text-[0.625rem] text-tertiary">
                esc
              </kbd>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-1">
              {results.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-tertiary">
                  Nothing matches “{query}”.
                </p>
              )}

              {results.map((command, index) => {
                const header =
                  !query && command.section !== lastSection
                    ? command.section
                    : undefined;
                lastSection = command.section;
                const Icon = command.icon;
                const isArmed = armed === command.id;

                return (
                  <div key={command.id}>
                    {header && (
                      <h2 className="px-2 pb-1 pt-2 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-tertiary">
                        {header}
                      </h2>
                    )}
                    <button
                      type="button"
                      disabled={command.disabled}
                      onPointerEnter={() => setActive(index)}
                      onClick={() => run(command)}
                      data-active={index === active || undefined}
                      className={`flex w-full items-center gap-2.5 rounded-control px-2 py-2 text-left text-sm outline-none transition-colors disabled:opacity-40 data-[active]:bg-hover ${
                        command.destructive ? "text-danger" : "text-ink"
                      }`}
                    >
                      {Icon && <Icon aria-hidden="true" className="size-4 shrink-0" />}
                      <span className="min-w-0 flex-1 truncate">
                        {isArmed ? `${command.label} — press again to confirm` : command.label}
                      </span>
                      {command.hint && !isArmed && (
                        <span className="shrink-0 font-mono text-[0.625rem] text-tertiary">
                          {command.hint}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </CommandContext.Provider>
  );
}
