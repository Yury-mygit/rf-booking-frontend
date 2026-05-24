// Bootstrap: theme → tg → router → auth → first render.
//
// Single-app архитектура: один TG WebApp instance, hash-routing по блокам
// (`#/` = entry-selector, `#/client/...`, `#/partner/...`, `#/admin/...`).
// Auth — один токен на сессию (variant B): backend сам проверяет per-endpoint
// доступность по profile/staff/user.role, без `requested_role` в /auth/tg.

import { api } from "./api.js";
import { applyTheme, watchTheme } from "./theme.js";
import { initTg, inTelegram, tg } from "./tg.js";
import { applyStaticI18n, cycleLang } from "./i18n.js";
import { initRouter, route, run, navigate } from "./router.js";
import { initTopbar } from "./topbar.js";
import { renderEntry } from "./entry/index.js";

applyTheme();
watchTheme();
initTg();
initTopbar();
applyStaticI18n();

document.getElementById("lang-cycle").addEventListener("click", () => {
  cycleLang();
  applyStaticI18n();
  run();
});

// Маршруты. Блоки регистрируются через dynamic import — код блока скачивается
// только при первом входе. Bundle entry остаётся компактным.
route("/", renderEntry);
route("/client/*", async (params) => (await import("./client/index.js")).render(params));
route("/partner/*", async (params) => (await import("./partner/index.js")).render(params));
route("/admin/*", async (params) => (await import("./admin/index.js")).render(params));

initRouter();

(async function bootstrap() {
  // 1. Если есть TG initData — поднимаем сессию без requested_role.
  //    Backend выдаёт universal-token, frontend решает где юзер по
  //    available_roles в whoami.
  if (inTelegram && tg && tg.initData) {
    try {
      const r = await api.authTg(tg.initData);
      api.setSession(r.token, r.user);
    } catch (e) {
      // Не валим bootstrap — entry view покажет fallback (dev-login или
      // сообщение «откройте через бота»).
      console.warn("authTg failed:", e.message);
    }
  }
  run();
})();
