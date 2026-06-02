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
    installViewportInsetTracker();
    return;
  }
  tg.ready();
  tg.expand();
  tryFullscreen();
  applyTheme(tg.colorScheme);
  tg.onEvent?.("themeChanged", () => applyTheme(tg.colorScheme));
  installViewportInsetTracker();
}

// Android Chrome не апдейтит env(safe-area-inset-bottom) при динамическом
// появлении системного нав-бара (3-button / gesture). iOS работает, Android —
// нет. Слушаем viewportChanged (TG) и visualViewport.resize (fallback),
// выставляем CSS var --sys-bottom-inset; CSS использует
// max(env(safe-area-inset-bottom), var(--sys-bottom-inset, 0px)).
//
// Различение «навбар vs клавиатура»: delta = stableHeight - liveHeight.
// Навбар — небольшая (24px gesture / 48-56px 3-button). Клавиатура — 200px+.
// Порог NAV_MAX_PX отделяет одно от другого; при превышении или нестабильном
// состоянии — var обнуляем (клавиатура и так перекрывает bottomnav, держать
// inset под ней бесполезно).
const NAV_MAX_PX = 120;

function installViewportInsetTracker() {
  const root = document.documentElement;
  const setInset = (px) => {
    root.style.setProperty("--sys-bottom-inset", Math.max(0, px) + "px");
  };

  // Primary source on TG 8.0+ (Bot API 8.0, Nov 2024): contentSafeAreaInset.
  // Updates dynamically when the system nav bar appears/disappears in
  // fullscreen mode, where viewportChanged on Android stays silent
  // because the bar is drawn as an overlay over the WebView.
  const useTgSafeArea =
    !!tg && typeof tg.onEvent === "function" &&
    (typeof tg.contentSafeAreaInset === "object" || typeof tg.safeAreaInset === "object");

  if (useTgSafeArea) {
    const readTgBottom = () => {
      // Two TG insets at the bottom: safeAreaInset (system — nav bar,
      // gesture handle) and contentSafeAreaInset (TG-internal overlays).
      // They're independent — system bar can be 48px while content is 0
      // (A73 readout) or vice versa. Take max to clear both.
      const s = Number.isFinite(tg.safeAreaInset?.bottom) ? tg.safeAreaInset.bottom : 0;
      const c = Number.isFinite(tg.contentSafeAreaInset?.bottom) ? tg.contentSafeAreaInset.bottom : 0;
      return Math.max(s, c);
    };
    const applyTg = () => setInset(readTgBottom());
    tg.onEvent("contentSafeAreaChanged", applyTg);
    tg.onEvent("safeAreaChanged", applyTg);
    tg.onEvent("fullscreenChanged", applyTg);
    applyTg();
    return;
  }

  // Older TG / non-TG: best-effort viewportChanged + visualViewport. Won't
  // help in Android fullscreen (navbar overlay invisible to web), but works
  // for keyboard / standard window-resize scenarios.
  const apply = (stableH, liveH, isStable) => {
    const delta = Math.max(0, stableH - liveH);
    const isNavBar = isStable !== false && delta > 0 && delta < NAV_MAX_PX;
    setInset(isNavBar ? delta : 0);
  };
  if (tg && typeof tg.onEvent === "function") {
    tg.onEvent("viewportChanged", (e) => {
      apply(
        tg.viewportStableHeight || window.innerHeight,
        tg.viewportHeight || window.innerHeight,
        e?.isStateStable !== false,
      );
    });
    apply(
      tg.viewportStableHeight || window.innerHeight,
      tg.viewportHeight || window.innerHeight,
      true,
    );
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      apply(window.innerHeight, window.visualViewport.height, true);
    });
  }
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
