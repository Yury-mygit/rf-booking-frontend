// Admin Support Inbox: saved-views + filters + список тикетов.
// Live-обновление через SSE (admin events) — добавляет/обновляет тикеты.

import "../../../styles/support.css";

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { navigate } from "../../../router.js";
import { renderTicketCard } from "../../../widgets/support_ticket_card.js";

import { renderSupportSubNav } from "./_nav.js";

const VIEWS = ["active", "mine", "unassigned", "overdue", "archive"];

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function makeEventSource(url) {
  const tok = api.authToken();
  if (!tok) return null;
  const u = url.includes("?") ? `${url}&token=${encodeURIComponent(tok)}` : `${url}?token=${encodeURIComponent(tok)}`;
  try { return new EventSource(u); } catch { return null; }
}

export async function renderAdminSupportInbox() {
  const root = document.getElementById("app");
  root.innerHTML = `
    ${renderSupportSubNav("inbox")}
    <div class="support-views" id="support-tabs">
      ${VIEWS.map((v, i) =>
        `<button class="support-view${i === 0 ? " active" : ""}" data-view="${v}">${esc(t("support.tab." + v))}</button>`
      ).join("")}
    </div>
    <div class="support-filters">
      <input id="support-search" type="search" placeholder="${esc(t("support.search_placeholder"))}">
      <select id="support-fcat"><option value="">${esc(t("support.filters.category"))}</option></select>
      <select id="support-fpri">
        <option value="">${esc(t("support.filters.priority"))}</option>
        <option value="urgent">${esc(t("support.priority.urgent"))}</option>
        <option value="high">${esc(t("support.priority.high"))}</option>
        <option value="normal">${esc(t("support.priority.normal"))}</option>
        <option value="low">${esc(t("support.priority.low"))}</option>
      </select>
    </div>
    <div class="support-list" id="support-list"></div>
  `;

  let view = "active";
  let priority = "";
  let category_id = "";
  let q = "";

  // Загрузим категории в фильтр (полные, чтобы admin видел все).
  api.adminListCategories().then((cats) => {
    const sel = document.getElementById("support-fcat");
    for (const c of cats) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name_ru;  // на стороне админа — name_ru
      sel.appendChild(opt);
    }
  }).catch(() => {});

  async function load() {
    const listEl = document.getElementById("support-list");
    if (!listEl) return;
    listEl.innerHTML = `<div class="muted">${t("common.loading")}</div>`;
    try {
      const page = await api.adminListTickets({
        view, priority, category_id, q,
        limit: 100,
      });
      if (!page.items.length) {
        listEl.innerHTML = `<div class="support-list__empty">${t("support.empty_inbox")}</div>`;
        return;
      }
      listEl.innerHTML = "";
      for (const item of page.items) {
        const card = renderTicketCard(item, "agent");
        card.addEventListener("click", () => navigate(`#/admin/support/${item.number}`));
        listEl.appendChild(card);
      }
    } catch (e) {
      listEl.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    }
  }

  // События вкладок и фильтров.
  document.getElementById("support-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".support-view");
    if (!btn) return;
    document.querySelectorAll("#support-tabs .support-view").forEach((b) =>
      b.classList.toggle("active", b === btn)
    );
    view = btn.dataset.view;
    load();
  });
  let searchTimer;
  document.getElementById("support-search").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      q = e.target.value.trim();
      load();
    }, 300);
  });
  document.getElementById("support-fcat").addEventListener("change", (e) => {
    category_id = e.target.value;
    load();
  });
  document.getElementById("support-fpri").addEventListener("change", (e) => {
    priority = e.target.value;
    load();
  });

  await load();

  // SSE: на любой ticket-event перезагружаем текущий view.
  const es = makeEventSource(api.adminEventsUrl());
  if (es) {
    let reloadTimer;
    es.addEventListener("message", () => {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(load, 800);  // дебаунс серии events
    });
    const cleanup = () => {
      try { es.close(); } catch {}
      window.removeEventListener("hashchange", cleanup);
    };
    window.addEventListener("hashchange", cleanup);
  }
}
