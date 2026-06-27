// Perms tab — карточка на каждого staff:
//   * блоки assigned ролей с per-role hotel chips (multi-select модалка)
//   * dropdown «+ добавить роль»
//   * 5 tri-state чекбоксов (override per partner)
//   * Save
// Карта #12 (per-hotel scope): role × hotel_id tuples. Payload —
// `role_assignments: [{role_id, hotel_id}]`. NULL hotel_id = legacy/global
// (FE его не создаёт, только показывает если пришёл с backend).

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { escapeHtml } from "../../../util.js";

import { PERMS, ownerCanManage, render as renderStaffList } from "./index.js";
import { triStateHtml, wireTriState, readTriState } from "./tristate.js";

export async function renderPermsTab(app, ownerId) {
  const { canManage } = ownerCanManage(ownerId);
  app.innerHTML = `<p class="muted">${t("app.loading")}</p>`;
  let staff, allRoles, allHotels;
  try {
    [staff, allRoles, allHotels] = await Promise.all([
      api.listStaff({ ownerId }),
      api.listRoles({ ownerId }),
      api.listHotels({ ownerId }),
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
      ${staff.map((s) => renderStaffCardHtml(s, allRoles, allHotels, canManage)).join("")}
    </div>
  `;

  if (canManage) {
    staff.forEach((s) => wireStaffCard(s, allRoles, allHotels));
  }
}

function renderStaffCardHtml(s, allRoles, allHotels, canManage) {
  const rolesById = new Map(allRoles.map((r) => [r.id, r]));
  // Group assignments by role_id → list of hotel_ids (null possible).
  const byRole = new Map();
  for (const a of (s.role_assignments || [])) {
    if (!byRole.has(a.role_id)) byRole.set(a.role_id, []);
    byRole.get(a.role_id).push(a.hotel_id);
  }
  const assignedRoleIds = [...byRole.keys()];
  return `
    <div class="staff-card" data-staff-id="${s.id}">
      <div class="staff-card-header">
        <strong>${escapeHtml(s.staff_display_name || "—")}</strong>
        <code class="muted">${s.staff_telegram_id}</code>
      </div>

      <div class="staff-card-section">
        <div class="staff-card-label">${t("perms.roles_label")}</div>
        <div class="role-scope-list" data-staff-id="${s.id}">
          ${assignedRoleIds.length === 0
            ? `<span class="muted">${t("perms.no_roles")}</span>`
            : assignedRoleIds.map((rid) =>
                renderRoleBlockHtml(rid, byRole.get(rid), rolesById, allHotels, canManage)
              ).join("")}
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

function renderRoleBlockHtml(roleId, hotelIds, rolesById, allHotels, canManage) {
  const r = rolesById.get(roleId);
  const roleName = r ? escapeHtml(r.name) : `#${roleId}`;
  const hotelsById = new Map(allHotels.map((h) => [h.id, h]));
  const xRoleBtn = canManage
    ? `<button class="chip-x" data-act="remove-role" data-role-id="${roleId}" aria-label="${t("perms.remove_role")}">×</button>`
    : "";
  const hotelChips = hotelIds.map((hid) => {
    if (hid === null) {
      return `<span class="hotel-chip hotel-chip--global">${t("perms.scope_all")}</span>`;
    }
    const h = hotelsById.get(hid);
    const hName = h ? escapeHtml(h.name_ru) : `#${hid}`;
    const xH = canManage
      ? `<button class="chip-x" data-act="remove-hotel" data-role-id="${roleId}" data-hotel-id="${hid}" aria-label="${t("perms.remove_hotel")}">×</button>`
      : "";
    return `<span class="hotel-chip" data-role-id="${roleId}" data-hotel-id="${hid}">${hName}${xH}</span>`;
  }).join("");
  const addHotelBtn = canManage
    ? `<button class="chip-add" data-act="open-hotel-modal" data-role-id="${roleId}">+ ${t("perms.add_hotel")}</button>`
    : "";
  return `
    <div class="role-block" data-role-id="${roleId}">
      <div class="role-block-header">
        <span class="role-chip">${roleName}${xRoleBtn}</span>
      </div>
      <div class="role-block-hotels" data-role-id="${roleId}">
        ${hotelChips || (canManage ? `<span class="muted">${t("perms.scope_empty")}</span>` : "")}
        ${addHotelBtn}
      </div>
    </div>
  `;
}

function renderTriRowHtml(perm, s, canManage) {
  const value = s.perms[perm];
  const effective = !!s.effective_perms[perm];
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

function wireStaffCard(s, allRoles, allHotels) {
  const rolesById = new Map(allRoles.map((r) => [r.id, r]));
  const hotelsById = new Map(allHotels.map((h) => [h.id, h]));
  // Local state: Map<role_id, Set<hotel_id|"_null">> (используем строку "_null"
  // для отображения NULL-scope в Set, потому что Set различает null/undefined).
  const local = new Map();
  for (const a of (s.role_assignments || [])) {
    if (!local.has(a.role_id)) local.set(a.role_id, new Set());
    local.get(a.role_id).add(a.hotel_id === null ? "_null" : a.hotel_id);
  }

  const listBox = document.querySelector(`.role-scope-list[data-staff-id="${s.id}"]`);
  const addWrap = document.querySelector(`.role-add-wrap[data-staff-id="${s.id}"]`);
  const triBox = document.querySelector(`.tri-matrix[data-staff-id="${s.id}"]`);
  const saveBtn = document.querySelector(`button[data-act="save"][data-staff-id="${s.id}"]`);
  const statusEl = document.querySelector(`.save-status[data-staff-id="${s.id}"]`);

  function rerenderRoleList() {
    if (local.size === 0) {
      listBox.innerHTML = `<span class="muted">${t("perms.no_roles")}</span>`;
    } else {
      listBox.innerHTML = [...local.entries()].map(([rid, hset]) => {
        const hids = [...hset].map((x) => (x === "_null" ? null : x));
        return renderRoleBlockHtml(rid, hids, rolesById, allHotels, true);
      }).join("");
    }
    rerenderAddBtn();
  }

  function rerenderAddBtn() {
    const remaining = allRoles.filter((r) => !local.has(r.id));
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

  listBox.addEventListener("click", (e) => {
    const xRole = e.target.closest('button[data-act="remove-role"]');
    if (xRole) {
      local.delete(Number(xRole.dataset.roleId));
      rerenderRoleList();
      return;
    }
    const xHotel = e.target.closest('button[data-act="remove-hotel"]');
    if (xHotel) {
      const rid = Number(xHotel.dataset.roleId);
      const hid = Number(xHotel.dataset.hotelId);
      const set = local.get(rid);
      if (set) {
        set.delete(hid);
        if (set.size === 0) {
          // если убрали все scope для роли — оставляем роль с пустым scope
          // (она перестанет быть активной после save, бэкенд не пишет пустой
          // assignment; но мы не удаляем UI-блок чтобы user мог добавить отели).
        }
      }
      rerenderRoleList();
      return;
    }
    const addH = e.target.closest('button[data-act="open-hotel-modal"]');
    if (addH) {
      const rid = Number(addH.dataset.roleId);
      openHotelModal(rid, local, allHotels, () => rerenderRoleList());
      return;
    }
  });

  addWrap.addEventListener("click", (e) => {
    const item = e.target.closest(".role-add-item");
    if (!item) return;
    const rid = Number(item.dataset.roleId);
    if (!local.has(rid)) {
      // Prefill: если у партнёра ровно 1 отель — сразу добавляем его в scope.
      const initial = new Set();
      if (allHotels.length === 1) {
        initial.add(allHotels[0].id);
      }
      local.set(rid, initial);
    }
    addWrap.querySelector("details")?.removeAttribute("open");
    rerenderRoleList();
  });

  wireTriState(triBox);

  saveBtn.onclick = async () => {
    statusEl.textContent = "";
    saveBtn.disabled = true;
    const perms = readTriState(triBox);
    const role_assignments = [];
    for (const [rid, hset] of local.entries()) {
      if (hset.size === 0) continue; // роль без отелей → не отправляем (no-op)
      for (const h of hset) {
        role_assignments.push({
          role_id: rid,
          hotel_id: h === "_null" ? null : h,
        });
      }
    }
    try {
      await api.updateStaff(s.id, { role_assignments, perms });
      renderStaffList();
    } catch (err) {
      statusEl.textContent = t("app.error", { msg: err.message });
      saveBtn.disabled = false;
    }
  };

  rerenderAddBtn();
}

function openHotelModal(roleId, local, allHotels, onClose) {
  // Mini-modal: search-input + checkbox-list of hotels (already-selected
  // pre-checked). Apply → mutate local set.
  const set = local.get(roleId) || new Set();
  const overlay = document.createElement("div");
  overlay.className = "hotel-scope-modal-overlay";
  overlay.innerHTML = `
    <div class="hotel-scope-modal">
      <div class="hotel-scope-modal-header">
        <strong>${t("perms.scope_modal_title")}</strong>
        <button class="link" data-act="close">×</button>
      </div>
      <input type="text" class="hotel-scope-search" placeholder="${t("perms.scope_modal_search")}" />
      <div class="hotel-scope-list"></div>
      <div class="hotel-scope-modal-actions">
        <button class="primary" data-act="apply">${t("app.save")}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const listEl = overlay.querySelector(".hotel-scope-list");
  const searchEl = overlay.querySelector(".hotel-scope-search");

  // selection — копия (модалка не мутирует local пока не нажат Apply).
  const sel = new Set([...set].filter((x) => x !== "_null"));

  function rerender() {
    const q = (searchEl.value || "").trim().toLowerCase();
    const items = allHotels.filter((h) =>
      !q || (h.name_ru || "").toLowerCase().includes(q)
    );
    listEl.innerHTML = items.map((h) => `
      <label class="hotel-scope-item">
        <input type="checkbox" data-hotel-id="${h.id}" ${sel.has(h.id) ? "checked" : ""} />
        <span>${escapeHtml(h.name_ru)}</span>
      </label>
    `).join("") || `<p class="muted">${t("perms.scope_modal_empty")}</p>`;
  }
  rerender();

  searchEl.addEventListener("input", rerender);
  listEl.addEventListener("change", (e) => {
    const cb = e.target.closest('input[type="checkbox"][data-hotel-id]');
    if (!cb) return;
    const hid = Number(cb.dataset.hotelId);
    if (cb.checked) sel.add(hid); else sel.delete(hid);
  });

  function close() {
    overlay.remove();
  }

  overlay.querySelector('button[data-act="close"]').onclick = close;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('button[data-act="apply"]').onclick = () => {
    // Удаляем старые "обычные" (не "_null") + добавляем новые.
    const wasNull = set.has("_null");
    set.clear();
    if (wasNull) set.add("_null");
    for (const h of sel) set.add(h);
    local.set(roleId, set);
    close();
    onClose();
  };
}
