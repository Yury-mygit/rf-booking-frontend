import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { navigate } from "../../router.js";
import { escapeHtml } from "../../util.js";
import { showToast } from "../../widgets/toast.js";
import { setSubBottomNav, setSubSubBottomNav } from "../nav.js";

const SVG_ATTR = 'viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const AMENITIES_ICON = `<svg ${SVG_ATTR}><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`;

const SUB_ICONS = {
  general: `<svg ${SVG_ATTR}><circle cx="12" cy="12" r="10"></circle><polyline points="8 12 11 15 16 9"></polyline></svg>`,
  dining: `<svg ${SVG_ATTR}><path d="M4 8h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8z"></path><path d="M17 10h2a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-2"></path><line x1="8" y1="2" x2="8" y2="5"></line><line x1="12" y1="2" x2="12" y2="5"></line></svg>`,
  placement: `<svg ${SVG_ATTR}><path d="M3 20V10a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10"></path><path d="M3 15h18"></path><rect x="7" y="10" width="4" height="3" rx="1"></rect></svg>`,
  rules: `<svg ${SVG_ATTR}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><polyline points="9 15 11 17 15 13"></polyline></svg>`,
};

const SUBSUB_TABS = [
  { key: "general",   labelKey: "amenity.subforms.general" },
  { key: "dining",    labelKey: "amenity.subforms.dining" },
  { key: "placement", labelKey: "amenity.subforms.placement" },
  { key: "rules",     labelKey: "amenity.subforms.rules" },
];

const DEFAULT_LEAF = "#/admin/settings/amenities/general";

export function mountSettingsShell(activeSubsub) {
  document.body.classList.add("has-subnav");
  document.body.classList.add("has-subsubnav");
  setSubBottomNav([
    {
      key: "amenities",
      label: t("nav.amenities"),
      icon: AMENITIES_ICON,
      active: true,
      onClick: () => navigate(DEFAULT_LEAF),
    },
  ]);
  setSubSubBottomNav(
    SUBSUB_TABS.map((it) => ({
      key: it.key,
      label: t(it.labelKey),
      icon: SUB_ICONS[it.key],
      active: it.key === activeSubsub,
      onClick: () => navigate("#/admin/settings/amenities/" + it.key),
    })),
  );
}

export function redirectSettings() {
  navigate(DEFAULT_LEAF);
}

// ─── Общие: реальный CRUD-view ───────────────────────────────────────
// TBB-65: динамический каталог, section=general.

const SECTION = "general";

async function renderGeneralOptions() {
  mountSettingsShell("general");
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="ao-form">
      <input type="text" id="ao-name" placeholder="${t("admin.amenities.name_placeholder")}" maxlength="80" />
      <textarea id="ao-desc" placeholder="${t("admin.amenities.desc_placeholder")}" maxlength="200"></textarea>
      <button type="button" class="primary" id="ao-create">${t("admin.amenities.create")}</button>
    </div>
    <div class="ao-list" id="ao-list">${t("app.loading")}</div>
  `;
  document.getElementById("ao-create").onclick = onCreate;
  await refresh();
}

async function refresh() {
  const list = document.getElementById("ao-list");
  try {
    const items = await api.adminListAmenityOptions(SECTION);
    renderList(items);
  } catch (e) {
    list.innerHTML = `<div class="error">${t("app.error", { msg: e.message })}</div>`;
  }
}

function renderList(items) {
  const list = document.getElementById("ao-list");
  if (!items.length) {
    list.innerHTML = `<p class="muted">${t("admin.amenities.empty")}</p>`;
    return;
  }
  list.innerHTML = items
    .map(
      (it) => `
      <div class="ao-item" draggable="true" data-id="${it.id}">
        <span class="ao-drag" aria-hidden="true">☰</span>
        <div class="ao-body">
          <div class="ao-name">${escapeHtml(it.name)}</div>
          <div class="ao-desc">${escapeHtml(it.description)}</div>
        </div>
        <label class="ao-active">
          <input type="checkbox" data-active="${it.id}" ${it.active ? "checked" : ""} />
          ${t("admin.amenities.active")}
        </label>
      </div>`,
    )
    .join("");
  wireList(items);
}

function wireList(items) {
  const list = document.getElementById("ao-list");
  list.querySelectorAll('input[type="checkbox"][data-active]').forEach((cb) => {
    cb.onchange = async () => {
      const id = Number(cb.dataset.active);
      const prev = !cb.checked;
      try {
        await api.adminUpdateAmenityOption(id, { active: cb.checked });
      } catch (e) {
        cb.checked = prev;
        showToast(t("app.error", { msg: e.message }));
      }
    };
  });
  wireDragDrop(items);
}

function wireDragDrop(items) {
  const list = document.getElementById("ao-list");
  const rows = [...list.querySelectorAll(".ao-item")];
  let dragging = null;
  rows.forEach((row) => {
    row.ondragstart = (e) => {
      dragging = row;
      row.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", row.dataset.id);
    };
    row.ondragend = () => {
      row.classList.remove("dragging");
      rows.forEach((r) => r.classList.remove("drag-over"));
      dragging = null;
    };
    row.ondragover = (e) => {
      if (!dragging || dragging === row) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      row.classList.add("drag-over");
    };
    row.ondragleave = () => row.classList.remove("drag-over");
    row.ondrop = async (e) => {
      e.preventDefault();
      row.classList.remove("drag-over");
      if (!dragging || dragging === row) return;
      const parent = list;
      const dragIdx = rows.indexOf(dragging);
      const dropIdx = rows.indexOf(row);
      if (dragIdx < dropIdx) parent.insertBefore(dragging, row.nextSibling);
      else parent.insertBefore(dragging, row);
      await saveOrder();
    };
  });
}

async function saveOrder() {
  const list = document.getElementById("ao-list");
  const order = [...list.querySelectorAll(".ao-item")].map((r) => Number(r.dataset.id));
  try {
    await api.adminReorderAmenityOptions(SECTION, order);
  } catch (e) {
    showToast(t("app.error", { msg: e.message }));
    await refresh();
  }
}

async function onCreate() {
  const name = document.getElementById("ao-name").value.trim();
  const desc = document.getElementById("ao-desc").value.trim();
  if (!name || !desc) {
    showToast(t("admin.amenities.name_desc_required"));
    return;
  }
  try {
    await api.adminCreateAmenityOption(SECTION, name, desc);
    document.getElementById("ao-name").value = "";
    document.getElementById("ao-desc").value = "";
    await refresh();
  } catch (e) {
    showToast(t("app.error", { msg: e.message }));
  }
}

// ─── Placeholder-leaf для 3 остальных subsub-табов ───────────────────

function renderPlaceholder(key) {
  mountSettingsShell(key);
  document.getElementById("app").innerHTML =
    `<p class="muted">${t("amenity.subforms." + key)}</p>`;
}

export const renderSettingsGeneral   = () => renderGeneralOptions();
export const renderSettingsDining    = () => renderPlaceholder("dining");
export const renderSettingsPlacement = () => renderPlaceholder("placement");
export const renderSettingsRules     = () => renderPlaceholder("rules");
