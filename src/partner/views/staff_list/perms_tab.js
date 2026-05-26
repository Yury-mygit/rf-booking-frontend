// Perms tab — матрица сотрудники × 4 perm-флага. Read-only визуально;
// клик по строке открывает edit-модалку (импорт из list_tab.js — там же
// её основное использование).

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { escapeHtml } from "../../../util.js";

import { PERMS, ownerCanManage } from "./index.js";
import { openEditModal } from "./list_tab.js";

export async function renderPermsTab(app, ownerId) {
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
