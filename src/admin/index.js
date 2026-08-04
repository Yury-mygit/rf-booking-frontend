// Admin block. Парсит `params.rest`, диспатчит на view, монтирует
// bottom-nav. Все 4 раздела (metrics/users/hotels/bookings) — корневые,
// back ведёт в hub (#/).

import "../styles/admin.css";

import { api } from "../api.js";
import { t } from "../i18n.js";
import { navigate } from "../router.js";
import { setTitle, showBack } from "../topbar.js";
import { inTelegram, tg } from "../tg.js";
import { renderMainNav, activeNavKey } from "./nav.js";

import { renderMetrics } from "./views/metrics.js";
import { renderUsers } from "./views/users.js";
import { renderHotels } from "./views/hotels.js";
import { renderBookings } from "./views/bookings.js";
import { renderAdminLogin } from "./views/login.js";
import { renderAdminSupportList } from "./views/support/list.js";
import { renderAdminSupportThread } from "./views/support/thread.js";

const ROUTES = [
  { re: /^\/?$/, h: () => renderMetrics(), titleKey: "pageTitle.adminMetrics" },
  { re: /^\/metrics$/, h: () => renderMetrics(), titleKey: "pageTitle.adminMetrics" },
  { re: /^\/users$/, h: () => renderUsers(), titleKey: "pageTitle.adminUsers" },
  { re: /^\/hotels$/, h: () => renderHotels(), titleKey: "pageTitle.adminHotels" },
  { re: /^\/bookings$/, h: () => renderBookings(), titleKey: "pageTitle.adminBookings" },
  { re: /^\/support$/, h: () => renderAdminSupportList(), titleKey: "pageTitle.adminSupport" },
  { re: /^\/support\/(\d+)$/, h: (m) => renderAdminSupportThread(m[1]), titleKey: "pageTitle.adminSupport" },
  { re: /^\/login$/, h: () => renderAdminLogin(), titleKey: "pageTitle.adminLogin" },
];

function syncTopChrome(rest) {
  renderMainNav(activeNavKey(rest));
  showBack(() => navigate("#/"));
}

export async function render(params) {
  document.body.dataset.block = "admin";
  const rest = params.rest || "/";

  // 1. Не залогинены — fallback: вне TG → dev-login, в TG → auth-bootstrap.
  if (!api.hasToken()) {
    if (!inTelegram) {
      setTitle(t("pageTitle.adminLogin"));
      showBack(() => navigate("#/"));
      renderAdminLogin();
      return;
    }
    if (tg && tg.initData) {
      try {
        const r = await api.authTg(tg.initData);
        api.setSession(r.token, r.user, r.accessible_owners);
      } catch (e) {
        document.getElementById("app").innerHTML =
          `<div class="error">${t("common.error", { msg: e.message })}</div>`;
        return;
      }
    } else {
      document.getElementById("app").innerHTML =
        `<p class="muted">${t("app.no_session", { bot: "rforge_stay_bot" })}</p>`;
      return;
    }
  }

  // 2. Dispatch.
  for (const { re, h, titleKey } of ROUTES) {
    const m = rest.match(re);
    if (m) {
      if (titleKey) setTitle(t(titleKey));
      syncTopChrome(rest);
      try {
        await h(m);
      } catch (e) {
        console.error("Admin route error:", e);
        document.getElementById("app").innerHTML =
          `<div class="error">${t("common.error", { msg: e.message })}</div>`;
      }
      return;
    }
  }

  setTitle(t("pageTitle.notFound"));
  document.getElementById("app").textContent = "404: /admin" + rest;
}
