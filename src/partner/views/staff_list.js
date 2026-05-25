import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { escapeHtml } from "../../util.js";

const PERMS = ["manage_hotel", "manage_rooms", "manage_bookings", "manage_staff"];

export async function renderStaffList() {
  const app = document.getElementById("app");
  const ownerId = api.activeOwnerId();
  if (!ownerId) {
    app.innerHTML = `<p class="muted">${t("staff.no_owner")}</p>`;
    return;
  }
  const owner = api.owners().find((o) => o.owner_user_id === ownerId);
  const canManage = !!(owner && (owner.is_self || (owner.perms && owner.perms.manage_staff)));

  app.innerHTML = `<p class="muted">${t("app.loading")}</p>`;
  let staff;
  let invites = [];
  try {
    staff = await api.listStaff({ ownerId });
    if (canManage) invites = await api.listStaffInvites(ownerId);
  } catch (e) {
    app.innerHTML = `<div class="error">${t("app.error", { msg: e.message })}</div>`;
    return;
  }

  app.innerHTML = `
    <div class="staff-header-row">
      <a class="pill-link" href="#/partner/audit">${t("staff.audit_link")}</a>
    </div>
    <p class="muted">${t("staff.scope_hint", { owner: owner ? (owner.owner_display_name || "—") : "—" })}</p>

    ${canManage ? `
    <section class="staff-add">
      <h3>${t("staff.add_title")}</h3>
      <form id="staff-add-form" class="form">
        <div class="form-row">
          <label for="staff-tg-id">${t("staff.telegram_id")}</label>
          <input id="staff-tg-id" type="number" required min="1" placeholder="123456789" />
        </div>
        <div class="form-row">
          <label for="staff-note">${t("staff.note")}</label>
          <input id="staff-note" type="text" maxlength="128" placeholder="${t("staff.note_placeholder")}" />
        </div>
        <fieldset class="perms-group">
          <legend>${t("staff.perms")}</legend>
          ${PERMS.map((p) => `
            <label class="perm-row">
              <input type="checkbox" name="${p}" ${p === "manage_bookings" ? "checked" : ""} />
              <span>${t("staff.perm." + p)}</span>
            </label>
          `).join("")}
        </fieldset>
        <button class="primary" type="submit">${t("staff.add_btn")}</button>
        <div id="staff-add-err" class="error" style="display:none"></div>
      </form>
    </section>
    ` : ""}

    <section class="staff-list">
      <h3>${t("staff.list_title")}</h3>
      ${staff.length === 0
        ? `<p class="muted">${t("staff.empty")}</p>`
        : `<table class="recent-table">
            <thead>
              <tr>
                <th>${t("staff.col_who")}</th>
                <th>${t("staff.col_tg")}</th>
                <th>${t("staff.col_perms")}</th>
                <th>${t("staff.col_note")}</th>
                ${canManage ? "<th></th>" : ""}
              </tr>
            </thead>
            <tbody>${staff.map((s) => renderStaffRow(s, canManage)).join("")}</tbody>
          </table>`}
    </section>

    ${canManage ? `
    <section class="staff-invites">
      <div class="staff-header-row">
        <h3>${t("staff.invites_title")}</h3>
        <button class="primary" id="invite-create-btn">${t("staff.invite_create_btn")}</button>
      </div>
      <p class="muted">${t("staff.invites_hint")}</p>
      ${invites.length === 0
        ? `<p class="muted">${t("staff.invites_empty")}</p>`
        : `<table class="recent-table">
            <thead>
              <tr>
                <th>${t("staff.col_perms")}</th>
                <th>${t("staff.col_note")}</th>
                <th>${t("staff.col_expires")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${invites.map(renderInviteRow).join("")}</tbody>
          </table>`}
    </section>
    ` : ""}
  `;

  if (canManage) {
    wireAddForm(ownerId);
    wireRowActions();
    wireInviteCreate(ownerId);
    wireInviteRowActions();
  }
}

function renderInviteRow(inv) {
  const permsLabels = PERMS.filter((p) => inv.perms[p]).map((p) => t("staff.perm_short." + p)).join(", ") || "—";
  const expires = new Date(inv.expires_at).toLocaleDateString();
  return `
    <tr data-id="${inv.id}">
      <td class="perms-cell">${escapeHtml(permsLabels)}</td>
      <td>${escapeHtml(inv.note || "—")}</td>
      <td>${escapeHtml(expires)}</td>
      <td class="row-actions">
        <button class="link" data-inv-act="copy" data-url="${escapeHtml(inv.url)}">${t("staff.invite_copy")}</button>
        <button class="link danger" data-inv-act="revoke" data-id="${inv.id}">${t("staff.invite_revoke")}</button>
      </td>
    </tr>
  `;
}

function wireInviteCreate(ownerId) {
  const btn = document.getElementById("invite-create-btn");
  if (!btn) return;
  btn.onclick = () => openInviteCreateModal(ownerId);
}

function wireInviteRowActions() {
  document.querySelectorAll(".staff-invites button[data-inv-act]").forEach((btn) => {
    btn.onclick = async () => {
      const act = btn.dataset.invAct;
      if (act === "copy") {
        const url = btn.dataset.url;
        try {
          await navigator.clipboard.writeText(url);
          btn.textContent = t("staff.invite_copied");
          setTimeout(() => (btn.textContent = t("staff.invite_copy")), 1500);
        } catch (_) {
          prompt(t("staff.invite_copy"), url);
        }
      } else if (act === "revoke") {
        if (!confirm(t("staff.invite_revoke_confirm"))) return;
        try {
          await api.revokeStaffInvite(Number(btn.dataset.id));
          await renderStaffList();
        } catch (err) {
          alert(err.message);
        }
      }
    };
  });
}

function openInviteCreateModal(ownerId) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card">
      <h3>${t("staff.invite_create_title")}</h3>
      <div class="form-row">
        <label>${t("staff.note")}</label>
        <input id="iv-note" type="text" maxlength="128" placeholder="${t("staff.note_placeholder")}" />
      </div>
      <div class="form-row">
        <label>${t("staff.invite_expires_in")}</label>
        <select id="iv-days">
          <option value="1">1</option>
          <option value="7" selected>7</option>
          <option value="30">30</option>
        </select>
      </div>
      <fieldset class="perms-group">
        <legend>${t("staff.perms")}</legend>
        ${PERMS.map((p) => `
          <label class="perm-row">
            <input type="checkbox" name="${p}" ${p === "manage_bookings" ? "checked" : ""} />
            <span>${t("staff.perm." + p)}</span>
          </label>
        `).join("")}
      </fieldset>
      <div class="row-actions">
        <button class="secondary" id="iv-cancel">${t("app.cancel")}</button>
        <button class="primary" id="iv-save">${t("staff.invite_create_btn")}</button>
      </div>
      <div id="iv-err" class="error" style="display:none"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("iv-cancel").onclick = () => overlay.remove();
  document.getElementById("iv-save").onclick = async () => {
    const note = document.getElementById("iv-note").value.trim() || null;
    const days = Number(document.getElementById("iv-days").value);
    const perms = {};
    PERMS.forEach((p) => {
      perms[p] = overlay.querySelector(`input[name=${p}]`).checked;
    });
    try {
      const inv = await api.createStaffInvite({ perms, note, expires_in_days: days }, ownerId);
      overlay.remove();
      try {
        await navigator.clipboard.writeText(inv.url);
      } catch (_) {}
      alert(t("staff.invite_created_alert", { url: inv.url }));
      await renderStaffList();
    } catch (err) {
      const errBox = document.getElementById("iv-err");
      errBox.textContent = t("app.error", { msg: err.message });
      errBox.style.display = "block";
    }
  };
}

function renderStaffRow(s, canManage) {
  const permsLabels = PERMS.filter((p) => s.perms[p]).map((p) => t("staff.perm_short." + p)).join(", ") || "—";
  return `
    <tr data-id="${s.id}">
      <td>${escapeHtml(s.staff_display_name || "—")}</td>
      <td><code>${s.staff_telegram_id}</code></td>
      <td class="perms-cell">${escapeHtml(permsLabels)}</td>
      <td>${escapeHtml(s.note || "—")}</td>
      ${canManage ? `<td class="row-actions">
        <button class="link" data-act="edit" data-id="${s.id}">${t("staff.edit")}</button>
        <button class="link danger" data-act="remove" data-id="${s.id}">${t("staff.remove")}</button>
      </td>` : ""}
    </tr>
  `;
}

function wireAddForm(ownerId) {
  const form = document.getElementById("staff-add-form");
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const errBox = document.getElementById("staff-add-err");
    errBox.style.display = "none";
    const tgId = Number(document.getElementById("staff-tg-id").value);
    const note = document.getElementById("staff-note").value.trim() || null;
    const perms = {};
    PERMS.forEach((p) => {
      perms[p] = form.querySelector(`input[name=${p}]`).checked;
    });
    try {
      await api.addStaff({ telegram_id: tgId, perms, note }, { ownerId });
      try {
        const w = await api.whoami();
        api.setSession(api.authToken(), api.user(), w.accessible_owners || []);
      } catch (_) {}
      await renderStaffList();
    } catch (err) {
      errBox.textContent = t("app.error", { msg: err.message });
      errBox.style.display = "block";
    }
  };
}

function wireRowActions() {
  document.querySelectorAll(".staff-list button[data-act]").forEach((btn) => {
    btn.onclick = async () => {
      const id = Number(btn.dataset.id);
      const act = btn.dataset.act;
      if (act === "remove") {
        if (!confirm(t("staff.remove_confirm"))) return;
        try {
          await api.removeStaff(id);
          await renderStaffList();
        } catch (err) {
          alert(err.message);
        }
      } else if (act === "edit") {
        openEditModal(id);
      }
    };
  });
}

async function openEditModal(staffId) {
  const ownerId = api.activeOwnerId();
  const list = await api.listStaff({ ownerId });
  const s = list.find((x) => x.id === staffId);
  if (!s) return alert(t("app.error", { msg: "not found" }));

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card">
      <h3>${t("staff.edit_title")}</h3>
      <p class="muted">${escapeHtml(s.staff_display_name || "—")} · <code>${s.staff_telegram_id}</code></p>
      <div class="form-row">
        <label>${t("staff.note")}</label>
        <input id="m-note" type="text" maxlength="128" value="${escapeHtml(s.note || "")}" />
      </div>
      <fieldset class="perms-group">
        <legend>${t("staff.perms")}</legend>
        ${PERMS.map((p) => `
          <label class="perm-row">
            <input type="checkbox" name="${p}" ${s.perms[p] ? "checked" : ""} />
            <span>${t("staff.perm." + p)}</span>
          </label>
        `).join("")}
      </fieldset>
      <div class="row-actions">
        <button class="secondary" id="m-cancel">${t("app.cancel")}</button>
        <button class="primary" id="m-save">${t("app.save")}</button>
      </div>
      <div id="m-err" class="error" style="display:none"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("m-cancel").onclick = () => overlay.remove();
  document.getElementById("m-save").onclick = async () => {
    const note = document.getElementById("m-note").value.trim() || null;
    const perms = {};
    PERMS.forEach((p) => {
      perms[p] = overlay.querySelector(`input[name=${p}]`).checked;
    });
    try {
      await api.updateStaff(staffId, { perms, note });
      overlay.remove();
      await renderStaffList();
    } catch (err) {
      const errBox = document.getElementById("m-err");
      errBox.textContent = t("app.error", { msg: err.message });
      errBox.style.display = "block";
    }
  };
}
