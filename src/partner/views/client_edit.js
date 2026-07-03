import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { navigate } from "../../router.js";
import { setTitle } from "../../topbar.js";
import { escapeHtml } from "../../util.js";
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

let _chatUnmount = null;

// Teardown при уходе с /partner/client/{id} — снимаем has-subnav и unmount'им
// чат. Один-разовый listener переустанавливается на каждый вход.
function armClientHubTeardown() {
  window.addEventListener("hashchange", function once() {
    const rest = location.hash.replace(/^#\/partner/, "").replace(/^#/, "").split("?")[0];
    if (!rest.startsWith("/client/")) {
      document.body.classList.remove("has-subnav");
      if (_chatUnmount) { try { _chatUnmount(); } catch {} _chatUnmount = null; }
      window.removeEventListener("hashchange", once);
    }
  });
}

export async function renderClientEdit({ clientId, sub = null }) {
  const resolvedSub = SUBS.includes(sub) ? sub : SUB_DEFAULT;
  mountClientHubSubnav(clientId, resolvedSub);
  return renderClientBody({ clientId });
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
  armClientHubTeardown();
}

async function renderClientBody({ clientId }) {
  const app = document.getElementById("app");
  app.innerHTML = t("app.loading");

  let client, history;
  try {
    [client, history] = await Promise.all([
      api.getClient(clientId),
      api.listClientBookings(clientId),
    ]);
  } catch (e) {
    app.innerHTML = `<div class="error">${t("app.error", { msg: e.message })}</div>`;
    return;
  }

  const canEdit = api.canDo("manage_bookings", api.activeOwnerId());
  const ro = canEdit ? "" : "readonly";

  setTitle(`${t("pageTitle.clientEdit")} / ${t("client.title")}`);
  app.innerHTML = `
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

      <form id="client-form">
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
        ${canEdit ? `<button type="submit" class="primary">${t("app.save")}</button>` : ""}
        <span id="save-status" class="muted small"></span>
      </form>
    </div>

    <h2 style="margin-top:24px">${t("client.history")}</h2>
    <div id="history">${historyHtml(history)}</div>

    <h2 style="margin-top:24px">${t("chat.title")}</h2>
    <div id="client-chat"></div>
  `;

  if (_chatUnmount) {
    try { _chatUnmount(); } catch {}
    _chatUnmount = null;
  }
  _chatUnmount = mountClientChat(
    document.getElementById("client-chat"),
    client,
    history,
  );
  // Chat teardown при уходе с /client/ обслуживается armClientHubTeardown
  // из renderClientEdit; здесь второй listener не нужен (он бы дёргал unmount
  // при info→chat переключении, а нам нужно unmount ТОЛЬКО за пределами hub'а).

  if (!canEdit) return;

  document.getElementById("client-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      first_name: fd.get("first_name").trim() || null,
      last_name: fd.get("last_name").trim() || null,
      phone: fd.get("phone").trim() || null,
      email: fd.get("email").trim() || null,
      doc_kind: fd.get("doc_kind") || null,
      doc_number: fd.get("doc_number").trim() || null,
    };
    const status = document.getElementById("save-status");
    status.textContent = "…";
    try {
      await api.updateClient(clientId, payload);
      status.textContent = t("client.saved");
    } catch (err) {
      status.textContent = err.message;
    }
  });

  document.getElementById("photo-upload").addEventListener("click", async () => {
    const f = document.getElementById("photo-file").files[0];
    if (!f) return;
    try {
      await api.uploadClientPhoto(clientId, f);
      renderClientEdit({ clientId });
    } catch (err) {
      alert(err.message);
    }
  });

  const rm = document.getElementById("photo-remove");
  if (rm) {
    rm.addEventListener("click", async () => {
      try {
        await api.deleteClientPhoto(clientId);
        renderClientEdit({ clientId });
      } catch (err) {
        alert(err.message);
      }
    });
  }
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
