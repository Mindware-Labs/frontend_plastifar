import { useEffect, type KeyboardEvent, type RefObject } from "react";

const ITEM_SELECTOR = '[role^="menuitem"]:not([disabled])';

function items(panel: HTMLElement | null): HTMLElement[] {
  return panel ? Array.from(panel.querySelectorAll<HTMLElement>(ITEM_SELECTOR)) : [];
}

/** Navegación por teclado para menús desplegables accesibles. */
export function useMenuKeyboard(panelRef: RefObject<HTMLElement | null>, open: boolean) {
  useEffect(() => {
    if (!open) return;
    const list = items(panelRef.current);
    const current = list.find((item) => item.getAttribute("aria-checked") === "true");
    // Un tick despues: el panel se monta y anima en el mismo render que abre.
    const id = window.setTimeout(() => (current ?? list[0])?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open, panelRef]);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const list = items(event.currentTarget);
    if (list.length === 0) return;

    const index = list.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;

    if (event.key === "ArrowDown") next = index < 0 ? 0 : (index + 1) % list.length;
    else if (event.key === "ArrowUp") next = index < 0 ? list.length - 1 : (index - 1 + list.length) % list.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = list.length - 1;

    if (next === null) return;
    event.preventDefault();
    list[next].focus();
  }

  return onKeyDown;
}
