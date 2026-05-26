// Add tab — quick-add по telegram_id + invite-ссылки (создание / список /
// отзыв / копирование). Под одной вкладкой два независимых блока, потому
// что оба про добавление сотрудника и часто используются вместе.

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { escapeHtml } from "../../../util.js";

import { PERMS, ownerCanManage, render } from "./index.js";

export async function renderAddTab(app, ownerId) {
  const { canManage } = ownerCanManage(ownerId);
  if (!canManage) {
    app.innerHTML = `<p class="muted">${t("staff.add_no_perm")}</p>`;
    return;
  }

  let invites = [];
  try {
    invites = await api.listStaffInvites(ownerId);
  } catch (_) {
    /* invites — мягко: если упадёт, секцию покажем пустой */
  }

  app.innerHTML = `
    <section class="staff-add">
      <h3>${t("staff.quick_add_title")}</h3>
      <p class="muted">${t("staff.add_hint")}</p>
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
        <div id="staff-add-ok" class="success" style="display:none"></div>
      </form>
    </section>

    <section class="staff-invites" style="margin-top:24px">
      <div class="staff-header-row">
        <h3 style="margin:0">${t("staff.invites_title")}</h3>
        <button class="primary" id="invite-create-btn" style="width:auto;margin:0">${t("staff.invite_create_btn")}</button>
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
  `;

  // Quick-add form
  const form = document.getElementById("staff-add-form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const errBox = document.getElementById("staff-add-err");
    const okBox = document.getElementById("staff-add-ok");
    errBox.style.display = "none";
    okBox.style.display = "none";
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
      okBox.textContent = t("staff.add_ok");
      okBox.style.display = "block";
      form.reset();
      PERMS.forEach((p) => {
        if (p === "manage_bookings") form.querySelector(`input[name=${p}]`).checked = true;
      });
    } catch (err) {
      errBox.textContent = t("app.error", { msg: err.message });
      errBox.style.display = "block";
    }
  };

  // Invite-link actions
  document.getElementById("invite-create-btn").onclick = () => openInviteCreateModal(ownerId);
  wireInviteRowActions(ownerId);
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

function wireInviteRowActions(ownerId) {
  document.querySelectorAll("button[data-inv-act]").forEach((btn) => {
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
          render();
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
      render();
    } catch (err) {
      const errBox = document.getElementById("iv-err");
      errBox.textContent = t("app.error", { msg: err.message });
      errBox.style.display = "block";
    }
  };
}
