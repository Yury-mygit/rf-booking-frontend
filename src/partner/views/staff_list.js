// Staff view с 4 табами в bottomnav: Сотрудники / Добавить / Права / Журнал.
// URL остаётся /partner/staff; активный таб — в module-state.
//
// «Добавить» содержит ОБА способа добавления: quick-add по telegram_id
// + invite-ссылка (генерация / список / отзыв / копирование).
// «Права» — read-only матрица сотрудники × 4 perm-флага; клик по строке
// открывает existing edit-модалку (там же редактируется note).
// «Журнал» переиспользует renderAudit() — title уже выставлен syncTopChrome'ом.

import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { escapeHtml } from "../../util.js";
import { setBottomNav } from "../nav.js";
import { renderAudit } from "./audit.js";

const PERMS = ["manage_hotel", "manage_rooms", "manage_bookings", "manage_staff"];

const SVG_ATTR = 'viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const TAB_ICONS = {
  list: `<svg ${SVG_ATTR}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 11l-3 3-2-2"></path></svg>`,
  add: `<svg ${SVG_ATTR}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="16" y1="11" x2="22" y2="11"></line></svg>`,
  perms: `<svg ${SVG_ATTR}><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`,
  journal: `<svg ${SVG_ATTR}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="13" y2="17"></line></svg>`,
};
const TABS = ["list", "add", "perms", "journal"];

let _state = { active: "list" };

function setStaffNav() {
  setBottomNav(
    TABS.map((name) => ({
      key: name,
      label: t("staff.tab." + name),
      icon: TAB_ICONS[name],
      active: name === _state.active,
      onClick: () => switchTab(name),
    })),
  );
}

function switchTab(name) {
  _state.active = name;
  setStaffNav();
  render();
}

export async function renderStaffList() {
  setStaffNav();
  render();
}

async function render() {
  const app = document.getElementById("app");
  const ownerId = api.activeOwnerId();
  if (!ownerId) {
    app.innerHTML = `<p class="muted">${t("staff.no_owner")}</p>`;
    return;
  }
  if (_state.active === "list") return renderListTab(app, ownerId);
  if (_state.active === "add") return renderAddTab(app, ownerId);
  if (_state.active === "perms") return renderPermsTab(app, ownerId);
  if (_state.active === "journal") return renderAudit();
}

function ownerCanManage(ownerId) {
  const owner = api.owners().find((o) => o.owner_user_id === ownerId);
  return { owner, canManage: !!(owner && (owner.is_self || (owner.perms && owner.perms.manage_staff))) };
}

// ─── Таб «Сотрудники» ───────────────────────────────────────────────────────

async function renderListTab(app, ownerId) {
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

async function openEditModal(staffId, ownerId) {
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

// ─── Таб «Добавить» — quick-add + invite-ссылки ─────────────────────────────

async function renderAddTab(app, ownerId) {
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

// ─── Таб «Права» — матрица сотрудники × perm-флаги ──────────────────────────

async function renderPermsTab(app, ownerId) {
  app.innerHTML = `<p class="muted">${t("app.loading")}</p>`;
  let staff;
  try {
    staff = await api.listStaff({ ownerId });
  } catch (e) {
    app.innerHTML = `<div class="error">${t("app.error", { msg: e.message })}</div>`;
    return;
  }
  const { canManage } = ownerCanManage(ownerId);

  if (staff.length === 0) {
    app.innerHTML = `<p class="muted">${t("staff.empty")}</p>`;
    return;
  }

  const headerCols = PERMS.map((p) => `<th class="perm-col">${t("staff.perm_short." + p)}</th>`).join("");
  const rows = staff.map((s) => {
    const cells = PERMS.map((p) =>
      `<td class="perm-cell">${s.perms[p] ? "<span class=\"perm-mark\">✓</span>" : "<span class=\"perm-mark muted\">—</span>"}</td>`
    ).join("");
    const clickable = canManage ? ` class="perm-row-click" data-id="${s.id}"` : "";
    const name = escapeHtml(s.staff_display_name || "—");
    return `<tr${clickable}><td>${name}</td>${cells}</tr>`;
  }).join("");

  app.innerHTML = `
    <p class="muted">${canManage ? t("staff.perms_matrix_hint") : t("staff.perms_matrix_readonly")}</p>
    <div class="perms-matrix-wrap">
      <table class="perms-matrix">
        <thead><tr><th>${t("staff.col_who")}</th>${headerCols}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  if (canManage) {
    document.querySelectorAll(".perm-row-click").forEach((tr) => {
      tr.onclick = () => openEditModal(Number(tr.dataset.id), ownerId);
    });
  }
}
