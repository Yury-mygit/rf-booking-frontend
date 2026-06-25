// Perms tab — карточка на каждого staff: chips assigned ролей +
// dropdown «+ Добавить роль» + 5 tri-state checkboxes + Save.
// Карта #135 Stage 6.2: M2M роли (Q1=α RBAC), tri-state override (Q2=tri),
// chip-режим β (только assigned + dropdown остальных).

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { escapeHtml } from "../../../util.js";

import { PERMS, ownerCanManage, render as renderStaffList } from "./index.js";
import { triStateHtml, wireTriState, readTriState } from "./tristate.js";

export async function renderPermsTab(app, ownerId) {
  const { canManage } = ownerCanManage(ownerId);
  app.innerHTML = `<p class="muted">${t("app.loading")}</p>`;
  let staff, allRoles;
  try {
    [staff, allRoles] = await Promise.all([
      api.listStaff({ ownerId }),
      api.listRoles({ ownerId }),
    ]);
  } catch (e) {
    app.innerHTML = `<div class="error">${t("app.error", { msg: e.message })}</div>`;
    return;
  }

  if (staff.length === 0) {
    app.innerHTML = `<p class="muted">${t("staff.empty")}</p>`;
    return;
  }

  app.innerHTML = `
    <p class="muted">${canManage ? t("staff.perms_matrix_hint") : t("staff.perms_matrix_readonly")}</p>
    <div class="staff-cards">
      ${staff.map((s) => renderStaffCardHtml(s, allRoles, canManage)).join("")}
    </div>
  `;

  if (canManage) {
    staff.forEach((s) => wireStaffCard(s, allRoles, ownerId));
  } else {
    // read-only: всё equally заблокировано через disabled (style only — handlers не вешаем).
  }
}

function renderStaffCardHtml(s, allRoles, canManage) {
  const rolesById = new Map(allRoles.map((r) => [r.id, r]));
  return `
    <div class="staff-card" data-staff-id="${s.id}">
      <div class="staff-card-header">
        <strong>${escapeHtml(s.staff_display_name || "—")}</strong>
        <code class="muted">${s.staff_telegram_id}</code>
      </div>

      <div class="staff-card-section">
        <div class="staff-card-label">${t("perms.roles_label")}</div>
        <div class="role-chips" data-staff-id="${s.id}">
          ${renderChipsHtml(s.roles.map((r) => r.id), rolesById, canManage)}
        </div>
        ${canManage ? `<div class="role-add-wrap" data-staff-id="${s.id}"></div>` : ""}
      </div>

      <div class="staff-card-section">
        <div class="staff-card-label">${t("perms.matrix_label")}</div>
        <div class="tri-matrix" data-staff-id="${s.id}">
          ${PERMS.map((p) => renderTriRowHtml(p, s, canManage)).join("")}
        </div>
      </div>

      ${canManage ? `<div class="staff-card-actions">
        <button class="primary" data-act="save" data-staff-id="${s.id}">${t("app.save")}</button>
        <span class="muted save-status" data-staff-id="${s.id}"></span>
      </div>` : ""}
    </div>
  `;
}

function renderChipsHtml(roleIds, rolesById, canManage) {
  if (roleIds.length === 0) {
    return `<span class="muted">${t("perms.no_roles")}</span>`;
  }
  return roleIds.map((id) => {
    const r = rolesById.get(id);
    const name = r ? escapeHtml(r.name) : `#${id}`;
    const x = canManage ? `<button class="chip-x" data-act="remove-role" data-role-id="${id}" aria-label="${t("perms.remove_role")}">×</button>` : "";
    return `<span class="role-chip" data-role-id="${id}">${name}${x}</span>`;
  }).join("");
}

function renderTriRowHtml(perm, s, canManage) {
  const value = s.perms[perm];                  // tri-state: bool | null
  const effective = !!s.effective_perms[perm];  // computed bool
  const indicator = value === null
    ? `<span class="tri-eff" title="${t("perms.effective_hint")}">→ ${effective ? "✓" : "—"}</span>`
    : "";
  return `
    <div class="tri-row">
      <span class="tri-label">${t("staff.perm." + perm)}</span>
      ${triStateHtml(perm, value, effective)}
      ${indicator}
    </div>
  `;
}

function wireStaffCard(s, allRoles, ownerId) {
  const rolesById = new Map(allRoles.map((r) => [r.id, r]));
  const local = {
    roleIds: new Set(s.roles.map((r) => r.id)),
  };

  const chipsBox = document.querySelector(`.role-chips[data-staff-id="${s.id}"]`);
  const addWrap = document.querySelector(`.role-add-wrap[data-staff-id="${s.id}"]`);
  const triBox = document.querySelector(`.tri-matrix[data-staff-id="${s.id}"]`);
  const saveBtn = document.querySelector(`button[data-act="save"][data-staff-id="${s.id}"]`);
  const statusEl = document.querySelector(`.save-status[data-staff-id="${s.id}"]`);

  function rerenderChips() {
    chipsBox.innerHTML = renderChipsHtml([...local.roleIds], rolesById, true);
    rerenderAddBtn();
  }

  function rerenderAddBtn() {
    const remaining = allRoles.filter((r) => !local.roleIds.has(r.id));
    if (remaining.length === 0) {
      addWrap.innerHTML = `<span class="muted">${t("perms.no_more_roles")}</span>`;
      return;
    }
    addWrap.innerHTML = `
      <details class="role-add-dropdown">
        <summary class="link">${t("perms.add_role_btn")}</summary>
        <div class="role-add-menu">
          ${remaining.map((r) => `<button class="role-add-item" data-role-id="${r.id}">${escapeHtml(r.name)}</button>`).join("")}
        </div>
      </details>
    `;
  }

  chipsBox.addEventListener("click", (e) => {
    const x = e.target.closest('button[data-act="remove-role"]');
    if (!x) return;
    local.roleIds.delete(Number(x.dataset.roleId));
    rerenderChips();
  });

  addWrap.addEventListener("click", (e) => {
    const item = e.target.closest(".role-add-item");
    if (!item) return;
    local.roleIds.add(Number(item.dataset.roleId));
    addWrap.querySelector("details")?.removeAttribute("open");
    rerenderChips();
  });

  wireTriState(triBox);  // изменения читаем разом в saveBtn handler

  saveBtn.onclick = async () => {
    statusEl.textContent = "";
    saveBtn.disabled = true;
    const perms = readTriState(triBox);
    try {
      await api.updateStaff(s.id, { role_ids: [...local.roleIds], perms });
      // Re-render всего таба, чтобы effective_perms и indicator пересчитались.
      renderStaffList();
    } catch (err) {
      statusEl.textContent = t("app.error", { msg: err.message });
      saveBtn.disabled = false;
    }
  };

  rerenderAddBtn();
}
