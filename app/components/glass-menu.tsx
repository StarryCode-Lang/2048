"use client";

import { useEffect, useId, useRef } from "react";

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
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selected = options[selectedIndex] ?? options[0];

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
        onClick={onToggle}
        onKeyDown={(event) => {
          if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          event.stopPropagation();
          const target = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : event.key === "ArrowUp" ? selectedIndex - 1 : selectedIndex + 1;
          if (!open) {
            pendingFocusIndexRef.current = target;
            onToggle();
          } else focusOption(target);
        }}
      >
        <span dir={selected.dir}>{compact ? selected.short ?? selected.label : selected.label}</span>
        <i aria-hidden="true">⌄</i>
      </button>
      {open && (
        <div id={menuId} className="glass-popover" role="listbox" aria-label={label}>
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
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  onToggle();
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
              <i aria-hidden="true">{option.value === value ? "✓" : ""}</i>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
