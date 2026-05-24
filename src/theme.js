// Применить TG WebApp theme palette в CSS-переменные. Watch theme-change.

import { tg } from "./tg.js";

function applyVars() {
  if (!tg || !tg.themeParams) return;
  const p = tg.themeParams;
  const root = document.documentElement.style;
  if (p.bg_color) root.setProperty("--bg", p.bg_color);
  if (p.secondary_bg_color) root.setProperty("--surface", p.secondary_bg_color);
  if (p.text_color) root.setProperty("--text", p.text_color);
  if (p.hint_color) root.setProperty("--muted", p.hint_color);
  if (p.button_color) root.setProperty("--accent", p.button_color);
  if (p.button_text_color) root.setProperty("--accent-text", p.button_text_color);
  if (p.section_separator_color) root.setProperty("--border", p.section_separator_color);
  if (p.destructive_text_color) root.setProperty("--danger", p.destructive_text_color);
}

export function applyTheme() {
  applyVars();
}

export function watchTheme() {
  if (!tg || !tg.onEvent) return;
  tg.onEvent("themeChanged", applyVars);
}
