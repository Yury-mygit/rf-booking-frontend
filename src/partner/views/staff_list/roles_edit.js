// Roles edit modal — карта #135 Stage 5.2.
// openRoleEdit(roleId, ownerId, onSaved):
//   roleId === null → создание (нет кнопки Delete).
//   roleId  !== null → редактирование (есть Delete; 409 role_in_use
//   отрисовывается inline с списком staff из detail.staff).
// onSaved — колбэк после успешного сохранения/удаления (re-render таба).

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { escapeHtml } from "../../../util.js";

import { PERMS } from "./index.js";

export async function openRoleEdit(roleId, ownerId, onSaved) {
  let role = null;
  if (roleId != null) {
    try {
      const list = await api.listRoles({ ownerId });
      role = list.find((r) => r.id === roleId);
    } catch (e) {
      return alert(t("app.error", { msg: e.message }));
    }
    if (!role) return alert(t("app.error", { msg: "not found" }));
  }

  const isNew = role == null;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card">
      <h3>${t(isNew ? "roles.new" : "roles.edit")}</h3>
      <div class="form-row">
        <label>${t("roles.name_label")}</label>
        <input id="r-name" type="text" maxlength="64"
               placeholder="${t("roles.name_placeholder")}"
               value="${escapeHtml(role?.name || "")}" />
      </div>
      <fieldset class="perms-group">
        <legend>${t("staff.perms")}</legend>
        ${PERMS.map((p) => `
          <label class="perm-row">
            <input type="checkbox" name="${p}" ${role?.perms?.[p] ? "checked" : ""} />
            <span>${t("staff.perm." + p)}</span>
          </label>
        `).join("")}
      </fieldset>
      <div id="r-err" class="error" style="display:none"></div>
      <div id="r-blocked" class="error" style="display:none"></div>
      <div class="row-actions">
        ${isNew ? "" : `<button class="link danger" id="r-delete">${t("roles.delete")}</button>`}
        <span style="flex:1"></span>
        <button class="secondary" id="r-cancel">${t("app.cancel")}</button>
        <button class="primary" id="r-save">${t("app.save")}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const errBox = overlay.querySelector("#r-err");
  const blockedBox = overlay.querySelector("#r-blocked");

  function showErr(msg) {
    errBox.textContent = msg;
    errBox.style.display = "block";
  }

  overlay.querySelector("#r-cancel").onclick = () => overlay.remove();

  overlay.querySelector("#r-save").onclick = async () => {
    errBox.style.display = "none";
    blockedBox.style.display = "none";
    const name = overlay.querySelector("#r-name").value.trim();
    if (!name) return showErr(t("roles.name_required"));
    const perms = {};
    PERMS.forEach((p) => {
      perms[p] = overlay.querySelector(`input[name=${p}]`).checked;
    });
    try {
      if (isNew) await api.createRole({ name, perms }, { ownerId });
      else await api.updateRole(role.id, { name, perms });
      overlay.remove();
      if (onSaved) onSaved();
    } catch (err) {
      if (err.code === "name_taken") return showErr(t("roles.name_taken"));
      showErr(t("app.error", { msg: err.message }));
    }
  };

  if (!isNew) {
    overlay.querySelector("#r-delete").onclick = async () => {
      errBox.style.display = "none";
      blockedBox.style.display = "none";
      if (!confirm(t("roles.delete_confirm", { name: role.name }))) return;
      try {
        await api.deleteRole(role.id);
        overlay.remove();
        if (onSaved) onSaved();
      } catch (err) {
        if (err.code === "role_in_use" && err.detail?.staff) {
          const list = err.detail.staff
            .map((s) => `${escapeHtml(s.display_name || "—")} (<code>${s.telegram_id}</code>)`)
            .join(", ");
          blockedBox.innerHTML = `${t("roles.delete_blocked")}<br><span class="muted">${list}</span>`;
          blockedBox.style.display = "block";
          return;
        }
        showErr(t("app.error", { msg: err.message }));
      }
    };
  }
}
