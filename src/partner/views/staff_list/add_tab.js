// Add tab — quick-add по telegram_id + invite-ссылки. Карта #135 Stage 7:
//   - quick-add: chips ролей (M2M) + tri-state матрица override (default
//     все inherit, Q-α 2026-06-25);
//   - invite: минимальный (note + expires_in_days), без ролей и prefilled
//     perms (Q8). Бывший owner назначает роли/override сотруднику после
//     accept'а через таб «Права».

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { escapeHtml } from "../../../util.js";

import { PERMS, ownerCanManage, render } from "./index.js";
import { triStateHtml, wireTriState, readTriState } from "./tristate.js";

export async function renderAddTab(app, ownerId) {
  const { canManage } = ownerCanManage(ownerId);
  if (!canManage) {
    app.innerHTML = `<p class="muted">${t("staff.add_no_perm")}</p>`;
    return;
  }

  let invites = [];
  let roles = [];
  try {
    [invites, roles] = await Promise.all([
      api.listStaffInvites(ownerId),
      api.listRoles({ ownerId }),
    ]);
  } catch (_) {
    /* мягко: пустые секции, форма всё равно отрисуется */
  }

  app.innerHTML = `
    <section class="staff-add">
      <h3>${t("staff.quick_add_title")}</h3>
      <form id="staff-add-form" class="form">
        <div class="form-row form-row--horizontal">
          <label for="staff-tg-id">${t("staff.telegram_id")}</label>
          <input id="staff-tg-id" type="number" required min="1" placeholder="123456789" />
        </div>
        <div class="form-row form-row--horizontal">
          <label for="staff-note">${t("staff.note")}</label>
          <input id="staff-note" type="text" maxlength="128" placeholder="${t("staff.note_placeholder")}" />
        </div>

        <div class="staff-card-section">
          <div class="staff-card-label">${t("perms.roles_label")}</div>
          <div class="role-chips" id="add-chips"></div>
          <div class="role-add-wrap" id="add-role-wrap"></div>
        </div>

        <div class="staff-card-section">
          <div class="staff-card-label">${t("perms.matrix_label")}</div>
          <div class="tri-matrix" id="add-tri">
            ${PERMS.map((p) => `
              <div class="tri-row">
                <span class="tri-label">${t("staff.perm." + p)}</span>
                ${triStateHtml(p, null, false)}
              </div>
            `).join("")}
          </div>
        </div>

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
        : `<div class="table-scroll"><table class="recent-table">
            <thead>
              <tr>
                <th>${t("staff.col_note")}</th>
                <th>${t("staff.col_expires")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${invites.map(renderInviteRow).join("")}</tbody>
          </table></div>`}
    </section>
  `;

  // Quick-add: chips + tri-state local state
  const rolesById = new Map(roles.map((r) => [r.id, r]));
  const local = { roleIds: new Set() };
  const chipsBox = document.getElementById("add-chips");
  const addWrap = document.getElementById("add-role-wrap");
  const triBox = document.getElementById("add-tri");

  function rerenderChips() {
    chipsBox.innerHTML = renderChipsHtml([...local.roleIds], rolesById);
    rerenderAddBtn();
  }

  function rerenderAddBtn() {
    const remaining = roles.filter((r) => !local.roleIds.has(r.id));
    if (roles.length === 0) {
      addWrap.innerHTML = `<span class="muted">${t("staff.no_roles_yet")}</span>`;
      return;
    }
    if (remaining.length === 0) {
      addWrap.innerHTML = `<span class="muted">${t("perms.no_more_roles")}</span>`;
      return;
    }
    addWrap.innerHTML = `
      <details class="role-add-dropdown">
        <summary class="link">${t("perms.add_role_btn")}</summary>
        <div class="role-add-menu">
          ${remaining.map((r) => `<button type="button" class="role-add-item" data-role-id="${r.id}">${escapeHtml(r.name)}</button>`).join("")}
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

  wireTriState(triBox);
  rerenderChips();

  // Quick-add submit
  const form = document.getElementById("staff-add-form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const errBox = document.getElementById("staff-add-err");
    const okBox = document.getElementById("staff-add-ok");
    errBox.style.display = "none";
    okBox.style.display = "none";
    const tgId = Number(document.getElementById("staff-tg-id").value);
    const note = document.getElementById("staff-note").value.trim() || null;
    const perms = readTriState(triBox);
    try {
      await api.addStaff(
        { telegram_id: tgId, role_ids: [...local.roleIds], perms, note },
        { ownerId },
      );
      // Refresh accessible_owners (новый staff может изменить effective у owner self).
      try {
        const w = await api.whoami();
        api.setSession(api.authToken(), api.user(), w.accessible_owners || []);
      } catch (_) {}
      okBox.textContent = t("staff.add_ok");
      okBox.style.display = "block";
      form.reset();
      local.roleIds.clear();
      // Сбросить tri-state на all inherit.
      triBox.querySelectorAll(".tristate").forEach((btn) => {
        btn.dataset.state = "inherit";
        btn.querySelector(".tristate-glyph").textContent = "·";
        btn.setAttribute("aria-checked", "mixed");
      });
      rerenderChips();
    } catch (err) {
      errBox.textContent = t("app.error", { msg: err.message });
      errBox.style.display = "block";
    }
  };

  // Invites
  document.getElementById("invite-create-btn").onclick = () => openInviteCreateModal(ownerId);
  wireInviteRowActions(ownerId);
}

function renderChipsHtml(roleIds, rolesById) {
  if (roleIds.length === 0) {
    return `<span class="muted">${t("perms.no_roles")}</span>`;
  }
  return roleIds.map((id) => {
    const r = rolesById.get(id);
    const name = r ? escapeHtml(r.name) : `#${id}`;
    return `<span class="role-chip" data-role-id="${id}">${name}<button type="button" class="chip-x" data-act="remove-role" data-role-id="${id}" aria-label="${t("perms.remove_role")}">×</button></span>`;
  }).join("");
}

function renderInviteRow(inv) {
  const expires = new Date(inv.expires_at).toLocaleDateString();
  return `
    <tr data-id="${inv.id}">
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
  // Q8: invite минимальный. Никаких ролей/perms — только note + срок.
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card">
      <h3>${t("staff.invite_create_title")}</h3>
      <p class="muted">${t("staff.invite_minimal_hint")}</p>
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
      <div id="iv-err" class="error" style="display:none"></div>
      <div class="row-actions">
        <button class="secondary" id="iv-cancel">${t("app.cancel")}</button>
        <button class="primary" id="iv-save">${t("staff.invite_create_btn")}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("iv-cancel").onclick = () => overlay.remove();
  document.getElementById("iv-save").onclick = async () => {
    const note = document.getElementById("iv-note").value.trim() || null;
    const days = Number(document.getElementById("iv-days").value);
    try {
      const inv = await api.createStaffInvite({ note, expires_in_days: days }, ownerId);
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
