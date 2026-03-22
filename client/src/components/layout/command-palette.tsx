import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useTheme } from "@/hooks/use-theme";
import { commandPaletteGroups } from "@/lib/command-palette-items";
import { Moon, Sun } from "lucide-react";

type CommandPaletteContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const CommandPaletteContext =
  createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error(
      "useCommandPalette must be used within CommandPaletteProvider",
    );
  }
  return ctx;
}

function CommandPaletteHotkeys() {
  const { toggle } = useCommandPalette();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "k" && e.key !== "K") return;
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      toggle();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  return null;
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  const value = useMemo(
    () => ({ open, setOpen, toggle }),
    [open, setOpen, toggle],
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPaletteHotkeys />
      <CommandPaletteDialog />
    </CommandPaletteContext.Provider>
  );
}

function CommandPaletteDialog() {
  const { open, setOpen } = useCommandPalette();
  const [, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const ThemeIcon = theme === "dark" ? Sun : Moon;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search tools, pages, and actions…" />
      <CommandList className="max-h-[min(420px,50vh)]">
        <CommandEmpty>No matching results.</CommandEmpty>
        {commandPaletteGroups.map((group) => (
          <CommandGroup key={group.heading} heading={group.heading}>
            {group.items.map((item) => {
              const Icon = item.icon;
              const value = [item.label, item.id, ...(item.keywords ?? [])].join(
                " ",
              );
              return (
                <CommandItem
                  key={item.id}
                  value={value}
                  onSelect={() => {
                    setLocation(item.href);
                    setOpen(false);
                  }}
                >
                  <Icon className="mr-2 h-4 w-4 shrink-0 opacity-80" />
                  <span>{item.label}</span>
                  <CommandShortcut>↵</CommandShortcut>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            value="theme appearance dark light mode color"
            onSelect={() => {
              toggleTheme();
              setOpen(false);
            }}
          >
            <ThemeIcon className="mr-2 h-4 w-4 shrink-0 opacity-80" />
            <span>
              Switch to {theme === "dark" ? "light" : "dark"} mode
            </span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
