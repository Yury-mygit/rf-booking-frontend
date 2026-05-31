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
  tryFullscreen();
  applyTheme(tg.colorScheme);
  tg.onEvent?.("themeChanged", () => applyTheme(tg.colorScheme));
}

// Bot API 8.0+ (TG 11.0+, ноябрь 2024): прячет нативный header TG —
// остаётся только overlay с ✕/⋮/Back в углу. Класс `tg-fullscreen`
// ставится по событию fullscreenChanged (асинхронно после успеха) —
// CSS открывает верхнюю «пустую полосу» #topnav под TG overlay.
//
// Только для mobile (ios / android). На desktop / web не запрашиваем —
// там нет native overlay поверх UI, и fullscreen-API часто no-op.
function tryFullscreen() {
  if (!tg || typeof tg.requestFullscreen !== "function") return;
  if (typeof tg.isVersionAtLeast === "function" && !tg.isVersionAtLeast("8.0")) return;
  const platform = (tg.platform || "").toLowerCase();
  if (platform !== "ios" && platform !== "android" && platform !== "android_x") return;

  const syncClass = () => {
    if (tg.isFullscreen) document.body.classList.add("tg-fullscreen");
    else document.body.classList.remove("tg-fullscreen");
  };
  tg.onEvent?.("fullscreenChanged", syncClass);
  tg.onEvent?.("fullscreenFailed", syncClass);
  try {
    tg.requestFullscreen();
  } catch (_) {
    // unsupported / denied — оставляем стандартный header.
  }
  // Если TG уже в fullscreen-state на момент init (после reload) —
  // событие может не выстрелить, синхронизируем сразу.
  syncClass();
}

function applyTheme(scheme) {
  document.documentElement.dataset.theme = scheme === "dark" ? "dark" : "light";
}
