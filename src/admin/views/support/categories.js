// Categories CRUD: slug + ru/en/ky + icon + default_priority + sort_order.
// Удаление работает только если у категории нет тикетов; иначе бэк
// возвращает 409 — просим deactivate через is_active checkbox.

import "../../../styles/support.css";

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";

import { renderSupportSubNav } from "./_nav.js";

const PRIORITIES = ["low", "normal", "high", "urgent"];

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

export async function renderAdminSupportCategories() {
  const root = document.getElementById("app");
  root.innerHTML = `
    ${renderSupportSubNav("categories")}
    <div class="support-mgmt">
      <button id="cat-add-btn">${esc(t("support.add_category"))}</button>
      <div id="cat-form" class="support-form" hidden></div>
      <div id="cat-list" class="support-mgmt__list">${esc(t("common.loading"))}</div>
    </div>
  `;

  document.getElementById("cat-add-btn").addEventListener("click", () => openForm(null));
  await load();
}

function openForm(existing) {
  const formEl = document.getElementById("cat-form");
  formEl.hidden = false;
  formEl.innerHTML = `
    <h3>${esc(existing ? t("support.categories.title") + ` · ${existing.slug}` : t("support.add_category"))}</h3>
    <label>slug
      <input id="cat-slug" type="text" maxlength="32" required pattern="[a-z0-9_-]+"
             value="${esc(existing?.slug || "")}" ${existing ? "disabled" : ""}>
    </label>
    <label>${esc(t("support.name_ru"))}
      <input id="cat-ru" type="text" required value="${esc(existing?.name_ru || "")}">
    </label>
    <label>${esc(t("support.name_en"))}
      <input id="cat-en" type="text" required value="${esc(existing?.name_en || "")}">
    </label>
    <label>${esc(t("support.name_ky"))}
      <input id="cat-ky" type="text" required value="${esc(existing?.name_ky || "")}">
    </label>
    <label>${esc(t("support.icon"))}
      <input id="cat-icon" type="text" maxlength="32" value="${esc(existing?.icon || "")}">
    </label>
    <label>${esc(t("support.default_priority"))}
      <select id="cat-prio">
        ${PRIORITIES.map((p) =>
          `<option value="${p}"${(existing?.default_priority || "normal") === p ? " selected" : ""}>${esc(t("support.priority." + p))}</option>`
        ).join("")}
      </select>
    </label>
    <label>${esc(t("support.sort_order"))}
      <input id="cat-sort" type="number" value="${existing?.sort_order ?? 0}">
    </label>
    ${existing ? `<label><input id="cat-active" type="checkbox"${existing.is_active ? " checked" : ""}> ${esc(t("support.is_active"))}</label>` : ""}
    <div class="support-form__row">
      <button id="cat-cancel" type="button">${esc(t("common.cancel"))}</button>
      <button id="cat-save" type="button">${esc(t("common.create"))}</button>
    </div>
  `;

  document.getElementById("cat-cancel").addEventListener("click", () => {
    formEl.hidden = true;
    formEl.innerHTML = "";
  });
  document.getElementById("cat-save").addEventListener("click", async () => {
    const body = {
      name_ru: document.getElementById("cat-ru").value.trim(),
      name_en: document.getElementById("cat-en").value.trim(),
      name_ky: document.getElementById("cat-ky").value.trim(),
      icon: document.getElementById("cat-icon").value.trim() || null,
      default_priority: document.getElementById("cat-prio").value,
      sort_order: Number(document.getElementById("cat-sort").value || 0),
    };
    try {
      if (existing) {
        const isActive = document.getElementById("cat-active").checked;
        await api.adminPatchCategory(existing.id, { ...body, is_active: isActive });
      } else {
        await api.adminCreateCategory({
          ...body,
          slug: document.getElementById("cat-slug").value.trim(),
        });
      }
      formEl.hidden = true;
      formEl.innerHTML = "";
      await load();
    } catch (e) {
      alert(t("common.error", { msg: e.message }));
    }
  });
}

async function load() {
  const listEl = document.getElementById("cat-list");
  try {
    const cats = await api.adminListCategories();
    listEl.innerHTML = cats.map((c) => `
      <div class="support-row" data-id="${c.id}">
        <div>
          <strong>${esc(c.name_ru)}</strong>
          <span class="muted">(${esc(c.slug)}, ${esc(c.default_priority)}${!c.is_active ? ", inactive" : ""})</span>
        </div>
        <div>
          <button class="cat-edit" data-id="${c.id}">${esc(t("common.confirm"))}</button>
          <button class="support-row__del" data-id="${c.id}">${esc(t("common.delete"))}</button>
        </div>
      </div>
    `).join("");

    const lookup = new Map(cats.map((c) => [c.id, c]));
    listEl.querySelectorAll(".cat-edit").forEach((btn) => {
      btn.addEventListener("click", () => openForm(lookup.get(Number(btn.dataset.id))));
    });
    listEl.querySelectorAll(".support-row__del").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm(t("support.confirm_delete_category"))) return;
        try {
          await api.adminDeleteCategory(Number(btn.dataset.id));
          await load();
        } catch (e) {
          alert(t("common.error", { msg: e.message }));
        }
      });
    });
  } catch (e) {
    listEl.innerHTML = `<div class="error">${esc(e.message)}</div>`;
  }
}
