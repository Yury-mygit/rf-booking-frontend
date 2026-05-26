// List tab — таблица сотрудников + edit/remove actions.
// openEditModal экспортируется — используется также из perms_tab.js
// (клик по строке матрицы прав).

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { escapeHtml } from "../../../util.js";

import { PERMS, ownerCanManage, render } from "./index.js";

export async function renderListTab(app, ownerId) {
  app.innerHTML = `<p class="muted">${t("app.loading")}</p>`;
  let staff;
  try {
    staff = await api.listStaff({ ownerId });
  } catch (e) {
    app.innerHTML = `<div class="error">${t("app.error", { msg: e.message })}</div>`;
    return;
  }
  const { owner, canManage } = ownerCanManage(ownerId);

  app.innerHTML = `
    <p class="muted">${t("staff.scope_hint", { owner: owner ? (owner.owner_display_name || "—") : "—" })}</p>
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
  `;
  if (canManage) wireRowActions(ownerId);
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

function wireRowActions(ownerId) {
  document.querySelectorAll("button[data-act]").forEach((btn) => {
    btn.onclick = async () => {
      const id = Number(btn.dataset.id);
      const act = btn.dataset.act;
      if (act === "remove") {
        if (!confirm(t("staff.remove_confirm"))) return;
        try {
          await api.removeStaff(id);
          render();
        } catch (err) {
          alert(err.message);
        }
      } else if (act === "edit") {
        openEditModal(id, ownerId);
      }
    };
  });
}

export async function openEditModal(staffId, ownerId) {
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
      render();
    } catch (err) {
      const errBox = document.getElementById("m-err");
      errBox.textContent = t("app.error", { msg: err.message });
      errBox.style.display = "block";
    }
  };
}
