// Staff list screen с 4 табами: Сотрудники / Добавить / Права / Журнал.
// URL остаётся /partner/staff; активный таб — в _state.
//
// «Добавить» — quick-add по telegram_id + invite-ссылки.
// «Права» — read-only матрица сотрудники × 4 perm-флага; клик по строке
// открывает existing edit-модалку (импорт из list_tab.js).
// «Журнал» — renderAudit() из ../audit.js.

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { setTitle } from "../../../topbar.js";
import { setSubBottomNav } from "../../nav.js";
import { renderAudit } from "../audit.js";

import { renderListTab } from "./list_tab.js";
import { renderAddTab } from "./add_tab.js";
import { renderPermsTab } from "./perms_tab.js";
import { renderRolesTab } from "./roles_tab.js";

export const PERMS = ["manage_hotel", "manage_rooms", "manage_bookings", "manage_staff", "chat_with_clients"];

const SVG_ATTR = 'viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
export const TAB_ICONS = {
  list: `<svg ${SVG_ATTR}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 11l-3 3-2-2"></path></svg>`,
  add: `<svg ${SVG_ATTR}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="16" y1="11" x2="22" y2="11"></line></svg>`,
  perms: `<svg ${SVG_ATTR}><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`,
  roles: `<svg ${SVG_ATTR}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`,
  journal: `<svg ${SVG_ATTR}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="13" y2="17"></line></svg>`,
};
export const TABS = ["list", "add", "perms", "roles", "journal"];

export const _state = { active: "list" };

// body.has-subnav держит padding-bottom на main#app, чтобы последняя
// карточка не уходила под субпанель. Снимаем при уходе с /partner/staff
// и /partner/audit — иначе соседние views получают лишний отступ.
// Default-teardown в syncTopChrome (partner/index.js) дополнительно
// гарантирует hide; этот hashchange — для UX без двойного re-render'а.
window.addEventListener("hashchange", () => {
  const hash = location.hash.replace(/^#/, "").split("?")[0];
  if (!/^\/partner\/(staff|audit)\/?$/.test(hash)) {
    document.body.classList.remove("has-subnav");
    document.body.classList.remove("has-create-bar");
  }
});

export function setStaffNav() {
  setSubBottomNav(
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
  document.body.classList.add("has-subnav");
  setStaffNav();
  render();
}

export async function render() {
  const app = document.getElementById("app");
  setTitle(`${t("pageTitle.staff")} / ${t("staff.tab." + _state.active)}`);
  // Create-bar — только в табе ролей; чистим перед каждым dispatch'ем,
  // renderRolesTab сам поднимет если canManage.
  if (_state.active !== "roles") document.body.classList.remove("has-create-bar");
  const ownerId = api.activeOwnerId();
  if (!ownerId) {
    app.innerHTML = `<p class="muted">${t("staff.no_owner")}</p>`;
    return;
  }
  if (_state.active === "list") return renderListTab(app, ownerId);
  if (_state.active === "add") return renderAddTab(app, ownerId);
  if (_state.active === "perms") return renderPermsTab(app, ownerId);
  if (_state.active === "roles") return renderRolesTab(app, ownerId);
  if (_state.active === "journal") return renderAudit();
}

export function ownerCanManage(ownerId) {
  const owner = api.owners().find((o) => o.owner_user_id === ownerId);
  return { owner, canManage: !!(owner && (owner.is_self || (owner.perms && owner.perms.manage_staff))) };
}
