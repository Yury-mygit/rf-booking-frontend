// TG WebApp wrapper. `inTelegram = !!tg` (наличие объекта) — этого
// достаточно, чтобы знать что мы в WebView. `initData` может быть пуст
// при некоторых конфигурациях, но сам tg-обёртка всегда есть.

export const tg = window.Telegram?.WebApp || null;
export const inTelegram = !!tg;

export function initTg() {
  if (!tg) return;
  tg.ready();
  tg.expand();
}
