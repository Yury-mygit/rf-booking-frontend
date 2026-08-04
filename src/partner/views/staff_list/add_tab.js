// Add tab — quick-add по telegram_id + ФИО + invite-ссылки. Карта #136:
// форма содержит только telegram_id + фамилия/имя/отчество (все nullable).
// Роли и tri-state perms назначаются отдельно через таб «Права».
// Invite — минимальный (note + expires_in_days), без ролей и prefilled
// perms (#135 Q8).

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { escapeHtml } from "../../../util.js";
import { showFloatingToast } from "../../../widgets/toast.js";

import { ownerCanManage, render } from "./index.js";

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
    /* мягко: пустой список */
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
          <label for="staff-last">${t("staff.last_name")}</label>
          <input id="staff-last" type="text" maxlength="128" />
        </div>
        <div class="form-row form-row--horizontal">
          <label for="staff-first">${t("staff.first_name")}</label>
          <input id="staff-first" type="text" maxlength="128" />
        </div>
        <div class="form-row form-row--horizontal">
          <label for="staff-middle">${t("staff.middle_name")}</label>
          <input id="staff-middle" type="text" maxlength="128" />
        </div>

        <button class="primary" type="submit">${t("staff.add_btn")}</button>
      </form>
    </section>

    <section class="staff-invites" style="margin-top:24px">
      <div class="staff-header-row">
        <h3 style="margin:0">${t("staff.invites_title")}</h3>
        <button class="primary" id="invite-create-btn" style="width:auto;margin:0">${t("staff.invite_create_btn")}</button>
      </div>
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

  const form = document.getElementById("staff-add-form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const tgId = Number(document.getElementById("staff-tg-id").value);
    const lastName = document.getElementById("staff-last").value.trim() || null;
    const firstName = document.getElementById("staff-first").value.trim() || null;
    const middleName = document.getElementById("staff-middle").value.trim() || null;
    try {
      await api.addStaff(
        {
          telegram_id: tgId,
          first_name: firstName,
          last_name: lastName,
          middle_name: middleName,
        },
        { ownerId },
      );
      showFloatingToast(t("staff.add_ok"));
      form.reset();
    } catch (err) {
      showFloatingToast(t("app.error", { msg: err.message }), { variant: "error" });
    }
  };

  document.getElementById("invite-create-btn").onclick = () => openInviteCreateModal(ownerId);
  wireInviteRowActions(ownerId);
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
  // #135 Q8: invite минимальный. Никаких ролей/perms — только note + срок.
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
