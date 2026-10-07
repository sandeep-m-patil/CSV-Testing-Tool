"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal accessible menu button (WAI-ARIA "menu button" pattern) without a
 * Radix dependency: Enter/Space/ArrowDown opens and focuses the first item,
 * ArrowUp/ArrowDown/Home/End move focus, Escape and Tab close and return focus
 * to the trigger, and clicking outside closes.
 */
interface MenuContextValue {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  menuId: string;
}

const MenuContext = React.createContext<MenuContextValue | null>(null);

function useMenu(): MenuContextValue {
  const context = React.useContext(MenuContext);
  if (!context) throw new Error("DropdownMenu components must be used inside <DropdownMenu>");
  return context;
}

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const menuId = React.useId();
  const value = React.useMemo(() => ({ isOpen, setOpen, triggerRef, menuId }), [isOpen, menuId]);
  return (
    <MenuContext.Provider value={value}>
      <div className="relative">{children}</div>
    </MenuContext.Provider>
  );
}

export const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ onClick, onKeyDown, ...props }, forwardedRef) => {
    const { isOpen, setOpen, triggerRef, menuId } = useMenu();
    const setRefs = (node: HTMLButtonElement | null) => {
      triggerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    };
    return (
      <button
        ref={setRefs}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={(event) => {
          onClick?.(event);
          setOpen(!isOpen);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        {...props}
      />
    );
  },
);
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

const MENU_ITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"])';

function focusItem(menu: HTMLElement, target: "first" | "last" | "next" | "prev") {
  const items = Array.from(menu.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR));
  if (items.length === 0) return;
  const index = items.indexOf(document.activeElement as HTMLElement);
  const positions = { first: 0, last: items.length - 1, next: (index + 1) % items.length, prev: (index - 1 + items.length) % items.length };
  items[positions[target]]?.focus();
}

const KEY_TO_TARGET: Record<string, "first" | "last" | "next" | "prev"> = {
  ArrowDown: "next",
  ArrowUp: "prev",
  Home: "first",
  End: "last",
};

export function DropdownMenuContent({
  className,
  align = "start",
  side = "bottom",
  children,
}: {
  className?: string;
  align?: "start" | "end";
  side?: "top" | "bottom";
  children: React.ReactNode;
}) {
  const { isOpen, setOpen, triggerRef, menuId } = useMenu();
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    if (menuRef.current) focusItem(menuRef.current, "first");
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen, setOpen, triggerRef]);

  if (!isOpen) return null;

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const target = KEY_TO_TARGET[event.key];
    if (target && menuRef.current) {
      event.preventDefault();
      focusItem(menuRef.current, target);
    } else if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  return (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-orientation="vertical"
      onKeyDown={onKeyDown}
      className={cn(
        "absolute z-50 min-w-[12rem] overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-xl shadow-black/50 animate-in fade-in-0 zoom-in-95",
        align === "end" ? "right-0" : "left-0",
        side === "top" ? "bottom-full mb-2" : "top-full mt-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

export const DropdownMenuItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { destructive?: boolean }
>(({ className, destructive = false, onClick, ...props }, ref) => {
  const { setOpen, triggerRef } = useMenu();
  return (
    <button
      ref={ref}
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={(event) => {
        onClick?.(event);
        setOpen(false);
        triggerRef.current?.focus();
      }}
      className={cn(
        "flex w-full cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground hover:bg-accent [&_svg]:size-4 [&_svg]:shrink-0",
        destructive ? "text-destructive focus:text-destructive" : "",
        className,
      )}
      {...props}
    />
  );
});
DropdownMenuItem.displayName = "DropdownMenuItem";

export function DropdownMenuLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-2 py-1.5 text-sm", className)} {...props} />;
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div role="separator" className={cn("-mx-1 my-1 h-px bg-border", className)} />;
}
