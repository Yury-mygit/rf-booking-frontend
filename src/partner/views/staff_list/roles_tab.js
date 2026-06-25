// Roles tab — CRUD должностей (переиспользуемые наборы из 5 perm-флагов).
// Карта #135 Stage 5.1: список карточек + create-bar; клик по карточке
// открывает модалку roles_edit (Stage 5.2). Stage 6 свяжет роли со
// staff через M2M junction (multi-select chips в perms_tab).

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { escapeHtml } from "../../../util.js";

import { PERMS, ownerCanManage } from "./index.js";
import { openRoleEdit } from "./roles_edit.js";

const createBarHtml = () =>
  `<div class="create-bar"><button class="primary" id="roles-create-btn">${t("roles.create_button")}</button></div>`;

export async function renderRolesTab(app, ownerId) {
  const { canManage } = ownerCanManage(ownerId);
  app.innerHTML = `<p class="muted">${t("app.loading")}</p>`;
  let roles;
  try {
    roles = await api.listRoles({ ownerId });
  } catch (e) {
    app.innerHTML = `<div class="error">${t("app.error", { msg: e.message })}</div>`;
    return;
  }

  if (canManage) document.body.classList.add("has-create-bar");

  const listHtml = roles.length === 0
    ? `<p class="muted">${t("roles.empty")}</p>`
    : `<div class="role-list">${roles.map(cardHtml).join("")}</div>`;

  app.innerHTML = listHtml + (canManage ? createBarHtml() : "");

  if (canManage) {
    document.getElementById("roles-create-btn").onclick = () => {
      openRoleEdit(null, ownerId, () => renderRolesTab(app, ownerId));
    };
    document.querySelectorAll("[data-role-id]").forEach((el) => {
      el.onclick = () => {
        const id = Number(el.dataset.roleId);
        openRoleEdit(id, ownerId, () => renderRolesTab(app, ownerId));
      };
    });
  }
}

function cardHtml(r) {
  const granted = PERMS.filter((p) => r.perms[p]).length;
  return `
    <div class="card role-card clickable-card" data-role-id="${r.id}" role="button" tabindex="0">
      <h3>${escapeHtml(r.name)}</h3>
      <div class="meta">${t("roles.perms_count", { n: granted, total: PERMS.length })}</div>
    </div>
  `;
}
