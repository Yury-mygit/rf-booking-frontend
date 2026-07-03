import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { navigate } from "../../router.js";
import { setTitle } from "../../topbar.js";
import { escapeHtml } from "../../util.js";
import { showToast } from "../../widgets/toast.js";
import { setSubBottomNav } from "../nav.js";
import { mountClientChat } from "./client_edit_chat.js";

const DOC_KINDS = ["passport", "id_card", "driving_license", "other"];

// TBB-20 — client hub с 2 subform'ами. Локальный HUB_STRUCTURE аналог
// hotel_edit/index.js (D3 — не extract'им generic hub-primitive). URL:
// /partner/client/{id}/(info|chat); flat /partner/client/{id} → default info.
const SUB_DEFAULT = "info";
const SUBS = ["info", "chat"];

// Placeholder-иконки для Stage 1; финальные (person / chat-bubble)
// подберём на Stage 5.
const SVG_ATTR = 'viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const SUB_ICONS = {
  info: `<svg ${SVG_ATTR}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><circle cx="12" cy="16" r="0.5" fill="currentColor"></circle></svg>`,
  chat: `<svg ${SVG_ATTR}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
};

// Модуль-локальный state: `client` + `history` — грузятся раз при первом
// заходе в клиента (`ensureShell`); при переключении info↔chat не
// refetch'аются. Photo upload/remove сбрасывает `_mountedClientId`, чтобы
// принудительно перечитать.
const state = { client: null, history: null };
let _mountedClientId = null;
let _chatUnmount = null;

// Teardown при уходе с /partner/client/{id} — снимаем has-subnav и unmount'им
// чат. Один-разовый listener переустанавливается на каждый вход.
function armClientHubTeardown() {
  window.addEventListener("hashchange", function once() {
    const rest = location.hash.replace(/^#\/partner/, "").replace(/^#/, "").split("?")[0];
    if (!rest.startsWith("/client/")) {
      document.body.classList.remove("has-subnav");
      if (_chatUnmount) { try { _chatUnmount(); } catch {} _chatUnmount = null; }
      _mountedClientId = null;
      state.client = null;
      state.history = null;
      window.removeEventListener("hashchange", once);
    }
  });
}

async function ensureShell(clientId) {
  const app = document.getElementById("app");
  const existing = document.getElementById("client-hub-body");
  if (_mountedClientId === clientId && existing && state.client) {
    return existing;
  }
  app.innerHTML = t("app.loading");
  try {
    const [client, history] = await Promise.all([
      api.getClient(clientId),
      api.listClientBookings(clientId),
    ]);
    state.client = client;
    state.history = history;
  } catch (e) {
    app.innerHTML = `<div class="error">${t("app.error", { msg: e.message })}</div>`;
    _mountedClientId = null;
    return null;
  }
  app.innerHTML = `<div id="client-hub-body">${SUBS
    .map((k) => `<div class="hub-tab" data-tab="${k}" hidden></div>`)
    .join("")}</div>`;
  _mountedClientId = clientId;
  return document.getElementById("client-hub-body");
}

function mountClientHubSubnav(clientId, activeSub) {
  document.body.classList.add("has-subnav");
  setSubBottomNav(
    SUBS.map((key) => ({
      key,
      label: t("client.subforms." + key),
      icon: SUB_ICONS[key],
      active: key === activeSub,
      onClick: () => navigate(`#/partner/client/${clientId}/${key}`),
    })),
  );
}

const RENDERERS = {
  info: (body, id) => renderInfoSubform(body, id),
  chat: (body) => renderChatSubform(body),
};

async function showTab(clientId, sub) {
  const hubBody = document.getElementById("client-hub-body");
  if (!hubBody) return;
  // Уходим с чата — unmount, чтобы не работал SSE-listener пока не смотрим.
  if (sub !== "chat" && _chatUnmount) {
    try { _chatUnmount(); } catch {}
    _chatUnmount = null;
  }
  const bodyEl = hubBody.querySelector(`.hub-tab[data-tab="${sub}"]`);
  if (!bodyEl) return;
  await RENDERERS[sub](bodyEl, clientId);
  hubBody.querySelectorAll(".hub-tab").forEach((el) => {
    el.hidden = el.dataset.tab !== sub;
  });
}

export async function renderClientEdit({ clientId, sub = null }) {
  const resolvedSub = SUBS.includes(sub) ? sub : SUB_DEFAULT;
  const body = await ensureShell(clientId);
  if (!body) return;
  setTitle(`${t("pageTitle.clientEdit")} / ${t("client.title")}`);
  mountClientHubSubnav(clientId, resolvedSub);
  armClientHubTeardown();
  await showTab(clientId, resolvedSub);
}

async function savePartial(id, payload, rollback) {
  try {
    const updated = await api.updateClient(id, payload);
    state.client = updated;
  } catch {
    rollback();
    showToast(t("client.save_error"));
  }
}

function renderInfoSubform(body, clientId) {
  const client = state.client;
  const history = state.history;
  const canEdit = api.canDo("manage_bookings", api.activeOwnerId());
  const ro = canEdit ? "" : "readonly";

  body.innerHTML = `
    <div class="card">
      <div class="client-photo-block">
        ${client.photo_url
          ? `<img class="client-photo" src="${escapeHtml(client.photo_url)}" alt="photo">`
          : `<div class="client-photo client-photo-empty"></div>`}
        ${canEdit ? `<div>
          <input type="file" id="photo-file" accept="image/*" style="display:block;margin-bottom:6px">
          <button id="photo-upload" class="secondary">${t("client.photo.upload")}</button>
          ${client.photo_url ? `<button id="photo-remove" class="danger">${t("client.photo.remove")}</button>` : ""}
        </div>` : ""}
      </div>

      <form id="client-form" autocomplete="off">
        <label>${t("client.first_name")}<input name="first_name" value="${escapeHtml(client.first_name || "")}" required ${ro}></label>
        <label>${t("client.last_name")}<input name="last_name" value="${escapeHtml(client.last_name || "")}" ${ro}></label>
        <label>${t("client.phone")}<input name="phone" value="${escapeHtml(client.phone || "")}" ${ro}></label>
        <label>${t("client.email")}<input name="email" type="email" value="${escapeHtml(client.email || "")}" ${ro}></label>
        <label>${t("client.doc_kind")}
          <select name="doc_kind" ${canEdit ? "" : "disabled"}>
            <option value="">${t("client.doc_kind.none")}</option>
            ${DOC_KINDS.map(k => `<option value="${k}"${client.doc_kind === k ? " selected" : ""}>${t("client.doc_kind." + k)}</option>`).join("")}
          </select>
        </label>
        <label>${t("client.doc_number")}<input name="doc_number" value="${escapeHtml(client.doc_number || "")}" ${ro}></label>
      </form>
    </div>

    <h2 style="margin-top:24px">${t("client.history")}</h2>
    <div id="history">${historyHtml(history)}</div>
  `;

  if (!canEdit) return;

  const form = document.getElementById("client-form");

  // Auto-save per-field: <input> → blur → PUT {[key]: value}; <select> → change.
  // Пустая строка → null (backend требует min_length=1 для first_name; для
  // остальных null тоже допустим).
  form.querySelectorAll('input[name]').forEach((input) => {
    input.onblur = () => {
      const key = input.name;
      const raw = input.value.trim();
      const value = raw === "" ? null : raw;
      const prev = state.client[key] ?? null;
      if (value === prev) return;
      // first_name — обязательное; пустое не отправляем, откатим UI.
      if (key === "first_name" && value === null) {
        input.value = prev || "";
        return;
      }
      savePartial(clientId, { [key]: value }, () => {
        input.value = prev || "";
      });
    };
  });

  form.querySelectorAll('select[name]').forEach((select) => {
    select.onchange = () => {
      const key = select.name;
      const value = select.value || null;
      const prev = state.client[key] ?? null;
      if (value === prev) return;
      savePartial(clientId, { [key]: value }, () => {
        select.value = prev || "";
      });
    };
  });

  document.getElementById("photo-upload").addEventListener("click", async () => {
    const f = document.getElementById("photo-file").files[0];
    if (!f) return;
    try {
      await api.uploadClientPhoto(clientId, f);
      _mountedClientId = null; // force ensureShell to refetch client
      renderClientEdit({ clientId, sub: "info" });
    } catch (err) {
      alert(err.message);
    }
  });

  const rm = document.getElementById("photo-remove");
  if (rm) {
    rm.addEventListener("click", async () => {
      try {
        await api.deleteClientPhoto(clientId);
        _mountedClientId = null;
        renderClientEdit({ clientId, sub: "info" });
      } catch (err) {
        alert(err.message);
      }
    });
  }
}

function renderChatSubform(body) {
  const client = state.client;
  const history = state.history;
  if (_chatUnmount) { try { _chatUnmount(); } catch {} _chatUnmount = null; }
  body.innerHTML = "";
  _chatUnmount = mountClientChat(body, client, history);
}

function historyHtml(bookings) {
  if (!bookings.length) return `<p class="muted">${t("client.history.empty")}</p>`;
  return bookings.map(b => `
    <div class="card">
      <div><b>${escapeHtml(b.hotel_name_ru)}</b> · ${escapeHtml(b.room_name_ru)}
        <span class="status-pill ${b.status}">${t("bookings.status." + b.status)}</span></div>
      <div class="meta">${t("bookings.code", { code: b.code })}</div>
      <div class="meta">${t("bookings.dates", { ci: b.check_in, co: b.check_out, n: b.adults + b.children + b.infants })}</div>
      <div class="meta">${t("bookings.total", { total: b.total_kgs })}</div>
    </div>`).join("");
}
