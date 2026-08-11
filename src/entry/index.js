// Entry view (hub). Решает куда вести юзера:
// — single client + hotel deep-link → #/client/hotel/<slug>;
// — single role → #/<role>/;
// — multi-role → selector с блоками по правам.
//
// Deep-links читаем из tg.initDataUnsafe.start_param и из ?startapp= в URL.

import { api } from "../api.js";
import { t } from "../i18n.js";
import { navigate } from "../router.js";
import { setTitle, hideBack } from "../topbar.js";
import { hideBottomNav, setBottomNav } from "../bottomnav.js";
import { tg, inTelegram } from "../tg.js";

const BOT_USERNAME = "rforge_stay_bot";

const SVG_ATTR = 'viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

const ROLE_ICONS = {
  client: `<svg ${SVG_ATTR}><circle cx="12" cy="7" r="4"></circle><path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"></path></svg>`,
  partner: `<svg ${SVG_ATTR}><circle cx="7.5" cy="15.5" r="5.5"></circle><path d="m21 2-9.6 9.6"></path><path d="m15.5 7.5 3 3L22 7l-3-3"></path></svg>`,
  admin: `<svg ${SVG_ATTR}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path></svg>`,
};

function startParam() {
  const fromUrl = new URLSearchParams(window.location.search).get("startapp");
  if (fromUrl) return fromUrl;
  return tg?.initDataUnsafe?.start_param || null;
}

// Возвращает { kind: "hotel"|"invite"|null, payload }.
function parseStartParam(sp) {
  if (!sp) return { kind: null };
  if (sp.startsWith("hotel_")) {
    return { kind: "hotel", payload: sp.slice("hotel_".length) };
  }
  if (sp.startsWith("invite_")) {
    return { kind: "invite", payload: sp.slice("invite_".length) };
  }
  return { kind: null };
}

function defaultRouteForRole(role, dl) {
  if (role === "client") {
    if (dl.kind === "hotel") return `#/client/hotel/${encodeURIComponent(dl.payload)}`;
    return "#/client/";
  }
  if (role === "partner") {
    if (dl.kind === "invite") return `#/partner/invite/${encodeURIComponent(dl.payload)}`;
    return "#/partner/";
  }
  if (role === "admin") return "#/admin/";
  return "#/";
}

// Single-role: первый визит — auto-nav в единственный блок. Повторный
// (юзер пришёл сюда back-кнопкой из блока) — нечего показывать как Режим,
// выходим в бот. Multi-role всегда selector (back из блока вернёт сюда,
// back из самого selector'а — закроет WebApp в TG штатно: hideBack снимает
// наш handler, TG возвращает дефолтное поведение close).
let _autoNavigatedFromEntry = false;

export async function renderEntry() {
  setTitle(t("app.title"));
  hideBack();
  hideBottomNav();

  const app = document.getElementById("app");
  app.innerHTML = `<div class="hint">${t("common.loading")}</div>`;

  const botLink = `<a href="https://t.me/${BOT_USERNAME}">@${BOT_USERNAME}</a>`;

  // Symmetric с partner/admin (см. partner/index.js:174-195): в TG с
  // валидным initData даём entry inline второй шанс на authTg (bootstrap
  // мог упасть на stale initData). Иначе — реально нет token'а и мы в
  // браузере, показываем no_session.
  if (!api.hasToken()) {
    if (inTelegram && tg?.initData) {
      try {
        const r = await api.authTg(tg.initData);
        api.setSession(r.token, r.user, r.accessible_owners);
      } catch (_) {
        app.innerHTML = `<p class="muted">${t("app.session_stale", { bot: botLink })}</p>`;
        return;
      }
    } else {
      app.innerHTML = `<p class="muted">${t("app.no_session", { bot: botLink })}</p>`;
      return;
    }
  }

  let me;
  try {
    me = await api.whoami();
  } catch (e) {
    if (e.code === "token_expired" || e.status === 401) {
      api.clearSession();
      app.innerHTML = `<p class="muted">${t("app.session_stale", { bot: botLink })}</p>`;
    } else {
      app.innerHTML = `<p class="error">${t("common.error", { msg: e.message })}</p>`;
    }
    return;
  }

  const roles = me.available_roles || ["client"];
  const dl = parseStartParam(startParam());

  if (roles.length === 1) {
    if (_autoNavigatedFromEntry) {
      _autoNavigatedFromEntry = false;
      if (tg && typeof tg.close === "function") {
        tg.close();
        return;
      }
      // Браузер: tg.close недоступен — показываем подсказку.
      app.innerHTML = `<p class="muted">${t("entry.single_role_done")}</p>`;
      return;
    }
    _autoNavigatedFromEntry = true;
    navigate(defaultRouteForRole(roles[0], dl));
    return;
  }

  _autoNavigatedFromEntry = false;
  renderSelector(me, roles, dl);
}

function renderSelector(me, roles, dl) {
  document.body.dataset.block = "entry";
  const greeting = me.first_name
    ? t("entry.greeting_named", { name: me.first_name })
    : t("entry.greeting");

  const blocks = roles
    .map((role) => {
      const target = defaultRouteForRole(role, dl);
      return `
        <button class="entry-block" data-role="${role}" data-target="${escapeHtml(target)}" type="button">
          <span class="eb-title">${t(`entry.role_${role}_title`)}</span>
          <span class="eb-sub">${t(`entry.role_${role}_sub`)}</span>
        </button>
      `;
    })
    .join("");

  document.getElementById("app").innerHTML = `
    <h1 class="entry-greeting">${escapeHtml(greeting)}</h1>
    <p class="entry-subtitle muted">${t("entry.pick_role")}</p>
    <div class="entry-blocks">${blocks}</div>
  `;

  document.querySelectorAll(".entry-block").forEach((b) => {
    b.addEventListener("click", () => navigate(b.dataset.target));
  });

  const navItems = roles.map((role) => ({
    key: role,
    icon: ROLE_ICONS[role] || "",
    href: defaultRouteForRole(role, dl).replace(/^#/, ""),
  }));
  setBottomNav(navItems, { mode: "centered" });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}
