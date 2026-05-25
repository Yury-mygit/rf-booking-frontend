import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { escapeHtml } from "../../util.js";

export async function renderUsers() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="filter-row">
      <div>
        <label>${t("users.filter.role")}</label>
        <select id="f-role">
          <option value="">${t("users.filter.role_any")}</option>
          <option value="client">client</option>
          <option value="partner">partner</option>
          <option value="admin">admin</option>
        </select>
      </div>
      <div>
        <label>${t("users.filter.partner_status")}</label>
        <select id="f-status">
          <option value="">${t("users.filter.status_any")}</option>
          <option value="pending">${t("users.filter.status_pending")}</option>
          <option value="verified">${t("users.filter.status_verified")}</option>
        </select>
      </div>
    </div>
    <div id="list">${t("app.loading")}</div>
    <div id="modal-mount"></div>`;

  document.getElementById("f-role").onchange = load;
  document.getElementById("f-status").onchange = load;
  load();
}

async function load() {
  const role = document.getElementById("f-role").value;
  const status = document.getElementById("f-status").value;
  const list = document.getElementById("list");
  list.innerHTML = t("app.loading");
  try {
    const filters = { role };
    if (status === "pending") filters.pending = "true";
    else if (status === "verified") filters.verified = "true";
    const users = await api.adminListUsers(filters);
    if (!users.length) {
      list.innerHTML = `<p class="muted">${t("users.empty")}</p>`;
      return;
    }
    const byId = Object.fromEntries(users.map((u) => [String(u.id), u]));
    list.innerHTML = users.map(renderCard).join("");
    list.querySelectorAll("[data-verify]").forEach((b) => {
      b.onclick = () => openVerify(b.dataset.verify);
    });
    list.querySelectorAll("[data-promote]").forEach((b) => {
      b.onclick = () => runAction(b.dataset.promote, byId, "promote");
    });
    list.querySelectorAll("[data-revoke]").forEach((b) => {
      b.onclick = () => runAction(b.dataset.revoke, byId, "revoke");
    });
    list.querySelectorAll("[data-demote]").forEach((b) => {
      b.onclick = () => runAction(b.dataset.demote, byId, "demote");
    });
  } catch (e) {
    list.innerHTML = `<div class="error">${t("app.error", { msg: e.message })}</div>`;
  }
}

async function runAction(userId, byId, kind) {
  const u = byId[String(userId)];
  const name = [u?.first_name, u?.last_name].filter(Boolean).join(" ") || `uid=${userId}`;
  const confirmKey = {
    revoke: "users.confirm_revoke",
    demote: "users.confirm_demote",
    promote: null,
  }[kind];
  if (confirmKey && !confirm(t(confirmKey, { name }))) return;
  try {
    if (kind === "promote") await api.adminPromoteAdmin(userId);
    else if (kind === "revoke") await api.adminRevokePartner(userId);
    else if (kind === "demote") await api.adminDemoteAdmin(userId);
    load();
  } catch (e) {
    alert(t("app.error", { msg: e.message }));
  }
}

function renderCard(u) {
  const name = [u.first_name, u.last_name].filter(Boolean).map(escapeHtml).join(" ") || "—";
  const handle = u.username ? `<span class="muted small">@${escapeHtml(u.username)}</span>` : "";
  const contactParts = [];
  if (u.phone) contactParts.push(escapeHtml(u.phone));
  if (u.email) contactParts.push(escapeHtml(u.email));
  const contact = contactParts.length
    ? `<div class="meta">${contactParts.join(" · ")}</div>`
    : "";
  const stats = u.role === "partner"
    ? `<div class="meta">${t("users.stats", { h: u.hotels_count, b: u.bookings_count })}</div>`
    : (u.bookings_count
        ? `<div class="meta">${t("users.client_bookings", { b: u.bookings_count })}</div>`
        : "");
  const partnerPill = u.is_pending_partner
    ? `<span class="status-pill pending">${t("users.pill.pending")}</span>`
    : (u.is_verified_partner
        ? `<span class="status-pill verified">${t("users.pill.verified")}</span>`
        : "");
  const superPill = u.is_superadmin
    ? `<span class="status-pill superadmin">${t("users.pill.superadmin")}</span>`
    : "";
  const showVerify = u.is_pending_partner;
  const showRevoke = u.is_verified_partner;
  const showPromote = u.role !== "admin";
  const showDemote = u.role === "admin" && !u.is_superadmin;
  return `
    <div class="card">
      <div><b>${name}</b> ${handle}
        <span class="status-pill ${u.role}">${u.role}</span>
        ${partnerPill}
        ${superPill}
      </div>
      <div class="meta">${t("users.tg", { tg: u.telegram_id })} · uid=${u.id}</div>
      ${contact}
      ${stats}
      <div class="meta">${t("users.created", { dt: u.created_at.slice(0, 10) })}</div>
      <div class="row-actions">
        ${showVerify ? `<button class="primary" data-verify="${u.id}">${t("users.btn_verify")}</button>` : ""}
        ${showRevoke ? `<button class="danger" data-revoke="${u.id}">${t("users.btn_revoke_partner")}</button>` : ""}
        ${showPromote ? `<button class="secondary" data-promote="${u.id}">${t("users.btn_promote")}</button>` : ""}
        ${showDemote ? `<button class="danger" data-demote="${u.id}">${t("users.btn_demote_admin")}</button>` : ""}
      </div>
    </div>`;
}

function openVerify(userId) {
  const mount = document.getElementById("modal-mount");
  mount.innerHTML = `
    <div class="modal-bg">
      <div class="modal">
        <h2>${t("verify.title")}</h2>
        <div class="form-row"><label>${t("verify.company")}</label><input id="v-c" /></div>
        <div class="form-row"><label>${t("verify.inn")}</label><input id="v-i" /></div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="secondary" id="v-cancel">${t("app.cancel")}</button>
          <button class="primary" id="v-ok">${t("app.save")}</button>
        </div>
        <div id="v-err" class="error"></div>
      </div>
    </div>`;
  document.getElementById("v-cancel").onclick = () => (mount.innerHTML = "");
  document.getElementById("v-ok").onclick = async () => {
    const c = document.getElementById("v-c").value.trim();
    const i = document.getElementById("v-i").value.trim();
    if (!c) {
      document.getElementById("v-err").textContent = t("verify.company");
      return;
    }
    try {
      await api.adminVerifyPartner(userId, c, i || null);
      mount.innerHTML = "";
      load();
    } catch (e) {
      document.getElementById("v-err").textContent = t("app.error", { msg: e.message });
    }
  };
}
