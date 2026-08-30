"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

type GlassMenuOption = {
  value: string;
  label: string;
  short?: string;
  dir?: "ltr" | "rtl";
};

type GlassMenuProps = {
  value: string;
  options: GlassMenuOption[];
  label: string;
  tooltip: string;
  open: boolean;
  compact?: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
};

export function GlassMenu({
  value,
  options,
  label,
  tooltip,
  open,
  compact = false,
  onToggle,
  onChange,
}: GlassMenuProps) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pendingFocusIndexRef = useRef<number | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selected = options[selectedIndex] ?? options[0];

  useLayoutEffect(() => {
    if (!open || typeof window === "undefined") return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      const popover = popoverRef.current;
      if (!trigger || !popover) return;
      const triggerRect = trigger.getBoundingClientRect();
      const width = popover.getBoundingClientRect().width || 154;
      const height = popover.getBoundingClientRect().height;
      const gutter = 8;
      const left = Math.min(
        Math.max(gutter, triggerRect.right - width),
        Math.max(gutter, window.innerWidth - width - gutter),
      );
      const below = triggerRect.bottom + 9;
      const above = triggerRect.top - height - 9;
      const top = Math.min(
        Math.max(gutter, below <= window.innerHeight - gutter ? below : above),
        Math.max(gutter, window.innerHeight - height - gutter),
      );
      setPopoverPosition({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition, { passive: true });
    window.addEventListener("scroll", updatePosition, { passive: true, capture: true });
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updatePosition) : null;
    if (observer) {
      if (triggerRef.current) observer.observe(triggerRef.current);
      if (popoverRef.current) observer.observe(popoverRef.current);
    }
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      observer?.disconnect();
    };
  }, [open, options.length]);

  const toggleMenu = () => {
    if (!open) setPopoverPosition(null);
    onToggle();
  };

  useEffect(() => {
    if (!open) return;
    const targetIndex = pendingFocusIndexRef.current ?? selectedIndex;
    pendingFocusIndexRef.current = null;
    const frame = requestAnimationFrame(() => optionRefs.current[(targetIndex + options.length) % options.length]?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, options.length, selectedIndex]);

  const focusOption = (index: number) => {
    const normalized = (index + options.length) % options.length;
    optionRefs.current[normalized]?.focus();
  };

  return (
    <div className={`glass-menu${compact ? " compact" : ""}`} data-menu-root="true">
      <button
        ref={triggerRef}
        type="button"
        className="glass-menu-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-controls={menuId}
        aria-expanded={open}
        data-tooltip={tooltip}
        onClick={toggleMenu}
        onKeyDown={(event) => {
          if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          event.stopPropagation();
          const target = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : event.key === "ArrowUp" ? selectedIndex - 1 : selectedIndex + 1;
          if (!open) {
            pendingFocusIndexRef.current = target;
            toggleMenu();
          } else focusOption(target);
        }}
      >
        <span dir={selected.dir}>{compact ? selected.short ?? selected.label : selected.label}</span>
        <svg className="menu-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 4.5 3.5 3 3.5-3" /></svg>
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          id={menuId}
          className="glass-popover"
          role="listbox"
          aria-label={label}
          data-menu-root="true"
          style={popoverPosition ? { top: `${popoverPosition.top}px`, left: `${popoverPosition.left}px` } : { visibility: "hidden" }}
        >
          {options.map((option, index) => (
            <button
              ref={(element) => { optionRefs.current[index] = element; }}
              type="button"
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              tabIndex={index === selectedIndex ? 0 : -1}
              className={option.value === value ? "selected" : ""}
              dir={option.dir}
              onClick={(event) => {
                onChange(option.value);
                if (event.detail === 0) requestAnimationFrame(() => triggerRef.current?.focus());
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  toggleMenu();
                  requestAnimationFrame(() => triggerRef.current?.focus());
                  return;
                }
                const movement = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
                if (!movement && event.key !== "Home" && event.key !== "End") return;
                event.preventDefault();
                event.stopPropagation();
                focusOption(event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : index + movement);
              }}
            >
              <span>{option.label}</span>
              <i aria-hidden="true">{option.value === value && <svg className="menu-check" viewBox="0 0 16 16"><path d="m3 8.5 3.1 3L13 4.8" /></svg>}</i>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
