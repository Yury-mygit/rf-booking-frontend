// Tags CRUD: имя + color-picker. Любой support-agent.

import "../../../styles/support.css";

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";

import { renderSupportSubNav } from "./_nav.js";

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

export async function renderAdminSupportTags() {
  const root = document.getElementById("app");
  root.innerHTML = `
    ${renderSupportSubNav("tags")}
    <div class="support-mgmt">
      <form id="tag-form" class="support-form" autocomplete="off">
        <input id="tag-name" type="text" required maxlength="40" placeholder="${esc(t("support.tags.title"))}">
        <input id="tag-color" type="color" value="#888888">
        <button type="submit">${esc(t("support.add_tag"))}</button>
      </form>
      <div id="tag-list" class="support-mgmt__list">${esc(t("common.loading"))}</div>
    </div>
  `;

  document.getElementById("tag-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("tag-name").value.trim();
    const color = document.getElementById("tag-color").value;
    if (!name) return;
    try {
      await api.adminCreateTag({ name, color });
      document.getElementById("tag-name").value = "";
      await load();
    } catch (err) {
      alert(t("common.error", { msg: err.message }));
    }
  });

  await load();
}

async function load() {
  const listEl = document.getElementById("tag-list");
  try {
    const tags = await api.adminListTags();
    if (!tags.length) {
      listEl.innerHTML = `<div class="muted">—</div>`;
      return;
    }
    listEl.innerHTML = tags.map((tg) => `
      <div class="support-row" data-id="${tg.id}">
        <div>
          <span class="support-tag" style="background:${esc(tg.color)}">${esc(tg.name)}</span>
        </div>
        <div>
          <input class="tag-color-edit" type="color" value="${esc(tg.color)}" data-id="${tg.id}">
          <button class="support-row__del" data-id="${tg.id}">${esc(t("common.delete"))}</button>
        </div>
      </div>
    `).join("");

    listEl.querySelectorAll(".tag-color-edit").forEach((inp) => {
      inp.addEventListener("change", async () => {
        try {
          await api.adminPatchTag(Number(inp.dataset.id), { color: inp.value });
          await load();
        } catch (e) {
          alert(t("common.error", { msg: e.message }));
        }
      });
    });
    listEl.querySelectorAll(".support-row__del").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm(t("support.confirm_delete_tag"))) return;
        try {
          await api.adminDeleteTag(Number(btn.dataset.id));
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
