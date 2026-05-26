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
import { setBottomNav } from "../bottomnav.js";
import { tg } from "../tg.js";

const BOT_USERNAME = "rforge_stay_bot";

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
  setBottomNav([]);

  const app = document.getElementById("app");
  app.innerHTML = `<div class="hint">${t("common.loading")}</div>`;

  if (!api.hasToken()) {
    const bot = `<a href="https://t.me/${BOT_USERNAME}">@${BOT_USERNAME}</a>`;
    app.innerHTML = `<p class="muted">${t("app.no_session", { bot })}</p>`;
    return;
  }

  let me;
  try {
    me = await api.whoami();
  } catch (e) {
    app.innerHTML = `<p class="error">${t("common.error", { msg: e.message })}</p>`;
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
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}
