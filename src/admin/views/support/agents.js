// Admin Support Roster: список агентов + добавление + soft-delete.
// Доступ — `require_superadmin` (на бэкенде); если у юзера нет —
// получит 403, выводим common.error.

import "../../../styles/support.css";

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";

import { renderSupportSubNav } from "./_nav.js";

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

export async function renderAdminSupportAgents() {
  const root = document.getElementById("app");
  root.innerHTML = `
    ${renderSupportSubNav("agents")}
    <div class="support-mgmt">
      <button id="agent-add-btn" class="support-mgmt__add">${esc(t("support.add_agent"))}</button>
      <div id="agent-list" class="support-mgmt__list">${esc(t("common.loading"))}</div>
    </div>
    <div id="agent-form" class="support-form" hidden></div>
  `;

  document.getElementById("agent-add-btn").addEventListener("click", openAddForm);
  await load();
}

async function load() {
  const listEl = document.getElementById("agent-list");
  try {
    const agents = await api.adminListAgents(false);
    if (!agents.length) {
      listEl.innerHTML = `<div class="muted">—</div>`;
      return;
    }
    listEl.innerHTML = agents.map((a) => `
      <div class="support-row">
        <div>
          <strong>${esc(a.user.first_name || "")} ${esc(a.user.last_name || "")}</strong>
          <span class="muted">@${esc(a.user.username || "—")} · TG ${esc(a.user.telegram_id)}</span>
          ${a.is_lead ? `<span class="support-tag" style="background:#5ec85e">${esc(t("support.lead"))}</span>` : ""}
          ${a.note ? `<div class="muted" style="font-size:12px">${esc(a.note)}</div>` : ""}
        </div>
        <button class="support-row__del" data-id="${a.id}">${esc(t("support.actions.release"))}</button>
      </div>
    `).join("");
    listEl.querySelectorAll(".support-row__del").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm(t("support.confirm_remove_agent"))) return;
        try {
          await api.adminRemoveAgent(Number(btn.dataset.id));
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

function openAddForm() {
  const formEl = document.getElementById("agent-form");
  formEl.hidden = false;
  formEl.innerHTML = `
    <h3>${esc(t("support.add_agent"))}</h3>
    <input id="agent-q" placeholder="${esc(t("support.search_placeholder"))}" autofocus>
    <div id="agent-q-results" class="support-mgmt__list"></div>
    <label>${esc(t("support.note"))}: <input id="agent-note" type="text"></label>
    <label><input id="agent-lead" type="checkbox"> ${esc(t("support.lead"))}</label>
    <div class="support-form__row">
      <button id="agent-cancel" type="button">${esc(t("common.cancel"))}</button>
      <button id="agent-save" type="button" disabled>${esc(t("common.create"))}</button>
    </div>
  `;

  let chosen = null;
  const qInput = document.getElementById("agent-q");
  const resultsEl = document.getElementById("agent-q-results");
  let qTimer;
  qInput.addEventListener("input", () => {
    clearTimeout(qTimer);
    const q = qInput.value.trim();
    if (q.length < 2) {
      resultsEl.innerHTML = "";
      return;
    }
    qTimer = setTimeout(async () => {
      try {
        const users = await api.adminUsersSearch(q);
        resultsEl.innerHTML = users.length
          ? users.map((u) => `
              <div class="support-row support-row--clickable" data-user-id="${u.id}">
                <div>
                  <strong>${esc(u.first_name || "")} ${esc(u.last_name || "")}</strong>
                  <span class="muted">@${esc(u.username || "—")} · TG ${esc(u.telegram_id)} · ${esc(u.role)}</span>
                </div>
                <span></span>
              </div>
            `).join("")
          : `<div class="muted">—</div>`;
        resultsEl.querySelectorAll(".support-row--clickable").forEach((row) => {
          row.addEventListener("click", () => {
            chosen = Number(row.dataset.userId);
            resultsEl.querySelectorAll(".support-row").forEach((r) =>
              r.classList.toggle("is-selected", r === row)
            );
            document.getElementById("agent-save").disabled = false;
          });
        });
      } catch (e) {
        resultsEl.innerHTML = `<div class="error">${esc(e.message)}</div>`;
      }
    }, 250);
  });

  document.getElementById("agent-cancel").addEventListener("click", () => {
    formEl.hidden = true;
    formEl.innerHTML = "";
  });

  document.getElementById("agent-save").addEventListener("click", async () => {
    if (!chosen) return;
    try {
      await api.adminAddAgent({
        user_id: chosen,
        is_lead: document.getElementById("agent-lead").checked,
        note: document.getElementById("agent-note").value.trim() || null,
      });
      formEl.hidden = true;
      formEl.innerHTML = "";
      await load();
    } catch (e) {
      alert(t("common.error", { msg: e.message }));
    }
  });
}
