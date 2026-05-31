// TG WebApp wrapper. `inTelegram = !!tg` (наличие объекта) — этого
// достаточно, чтобы знать что мы в WebView. `initData` может быть пуст
// при некоторых конфигурациях, но сам tg-обёртка всегда есть.

export const tg = window.Telegram?.WebApp || null;
export const inTelegram = !!tg;

export function initTg() {
  if (!tg) {
    // Браузер вне TG: уважать prefers-color-scheme.
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    applyTheme(mq?.matches ? "dark" : "light");
    mq?.addEventListener?.("change", (e) => applyTheme(e.matches ? "dark" : "light"));
    return;
  }
  tg.ready();
  tg.expand();
  applyTheme(tg.colorScheme);
  tg.onEvent?.("themeChanged", () => applyTheme(tg.colorScheme));
}

function applyTheme(scheme) {
  document.documentElement.dataset.theme = scheme === "dark" ? "dark" : "light";
}
