"use client";

import { useEffect, useRef } from "react";

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** Keeps keyboard focus inside the active dialog and restores it on close. */
export function useModalFocus(active: boolean) {
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const rememberNonModalFocus = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && !target.closest("[role='dialog'][aria-modal='true']")) returnFocusRef.current = target;
    };
    const current = document.activeElement as HTMLElement | null;
    if (current && current !== document.body) returnFocusRef.current = current;
    document.addEventListener("focusin", rememberNonModalFocus);
    return () => document.removeEventListener("focusin", rememberNonModalFocus);
  }, []);

  useEffect(() => {
    if (!active) return;
    const currentlyFocused = document.activeElement as HTMLElement | null;
    const previouslyFocused = currentlyFocused?.closest("[role='dialog'][aria-modal='true']")
      ? returnFocusRef.current
      : currentlyFocused;
    let dialog: HTMLElement | null = null;
    const frame = requestAnimationFrame(() => {
      const dialogs = document.querySelectorAll<HTMLElement>("[role='dialog'][aria-modal='true']");
      dialog = dialogs.item(dialogs.length - 1);
      const first = dialog?.querySelector<HTMLElement>("[autofocus]")
        ?? dialog?.querySelector<HTMLElement>(focusableSelector);
      first?.focus();
    });

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)]
        .filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", trapFocus);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", trapFocus);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [active]);
}
