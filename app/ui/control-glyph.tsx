import type { ReactNode } from "react";

export type ControlIcon = "undo" | "volume" | "mute" | "sun" | "moon" | "help";

const paths: Record<ControlIcon, ReactNode> = {
  undo: <><path d="M9 8H5V4" /><path d="M5.4 8.1A7 7 0 1 1 5.8 17" /></>,
  volume: <><path d="M5 10v4h3l4 3V7L8 10H5Z" /><path d="M15 9.5a4 4 0 0 1 0 5" /><path d="M17.5 7a7.5 7.5 0 0 1 0 10" /></>,
  mute: <><path d="M5 10v4h3l4 3V7L8 10H5Z" /><path d="m16 10 4 4m0-4-4 4" /></>,
  sun: <><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M19.1 15.7A8 8 0 0 1 8.3 4.9a7.3 7.3 0 1 0 10.8 10.8Z" />,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.3 2.3 0 0 1 4.5.7c0 1.8-2.3 2-2.3 3.7" /><path d="M12 17h.01" /></>,
};

export function ControlGlyph({ name }: { name: ControlIcon }) {
  return <svg className="control-glyph" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}
