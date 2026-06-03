// User-side support views (list, thread, new).
// Используются из `client/views/support/*` и `partner/views/support/*`
// — тонкие обёртки. Префикс URL'ов параметризуется (`/client/support`
// vs `/partner/support`) — у client и partner свой layout, но логика
// и DOM идентичны.

import "../styles/support.css";

import { api } from "../api.js";
import { t } from "../i18n.js";
import { navigate } from "../router.js";
import { mountSupportChat } from "./support_chat.js";
import { renderTicketCard } from "./support_ticket_card.js";

const $app = () => document.getElementById("app");

function setHTML(html) { $app().innerHTML = html; }

function makeEventSource(url) {
  // EventSource не отправляет custom Authorization header (browsers spec).
  // Workaround: добавляем token как query param. Backend читает либо
  // header, либо ?token=. Если так не сделано — для v1 это будет
  // упрощено через cookie-сессии когда добавим.
  const tok = api.authToken();
  if (!tok) return null;
  const u = url.includes("?") ? `${url}&token=${encodeURIComponent(tok)}` : `${url}?token=${encodeURIComponent(tok)}`;
  try { return new EventSource(u); } catch { return null; }
}


// ─── List ──────────────────────────────────────────────────────────


export async function renderUserSupportList({ baseUrl }) {
  setHTML(`
    <div class="support-list-screen">
      <div class="support-views" id="support-tabs">
        <button class="support-view active" data-status="open">${t("support.tab.open")}</button>
        <button class="support-view" data-status="closed">${t("support.tab.closed")}</button>
        <a class="support-view" href="#${baseUrl}/new" style="margin-left:auto">${t("support.new_button")}</a>
      </div>
      <div class="support-list" id="support-list"></div>
    </div>
  `);

  const listEl = document.getElementById("support-list");
  const tabsEl = document.getElementById("support-tabs");
  let status = "open";

  async function load() {
    listEl.innerHTML = `<div class="muted">${t("common.loading")}</div>`;
    try {
      const page = await api.listMyTickets({ status, limit: 100 });
      if (!page.items.length) {
        listEl.innerHTML = `<div class="support-list__empty">${t("support.empty")}</div>`;
        return;
      }
      listEl.innerHTML = "";
      for (const item of page.items) {
        const card = renderTicketCard(item, "user");
        card.addEventListener("click", () => navigate(`${baseUrl}/${item.number}`));
        listEl.appendChild(card);
      }
    } catch (e) {
      listEl.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    }
  }

  tabsEl.querySelectorAll(".support-view[data-status]").forEach((btn) => {
    btn.addEventListener("click", () => {
      tabsEl.querySelectorAll(".support-view").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      status = btn.dataset.status;
      load();
    });
  });

  await load();
}


// ─── Thread ─────────────────────────────────────────────────────────


export async function renderUserSupportThread({ baseUrl, number }) {
  setHTML(`
    <div class="support-thread-screen" style="display:flex;flex-direction:column;height:calc(100dvh - var(--top-h) - var(--bn-h));">
      <div class="support-thread-head" style="padding:8px 12px;border-bottom:1px solid var(--border);">
        <div style="font-family:monospace;font-weight:600">${escapeHtml(number)}</div>
        <div id="support-thread-meta" class="muted" style="font-size:12px;"></div>
      </div>
      <div id="support-chat" style="flex:1;display:flex;flex-direction:column;min-height:0;"></div>
    </div>
  `);

  const metaEl = document.getElementById("support-thread-meta");
  const chatEl = document.getElementById("support-chat");

  let data;
  try {
    data = await api.getMyTicket(number);
  } catch (e) {
    setHTML(`<div class="error">${t("common.error", { msg: e.message })}</div>`);
    return;
  }
  const { ticket, messages } = data;

  metaEl.textContent = `${ticket.category.name} · ${t("support.status." + ticket.status)}`;

  const ctrl = mountSupportChat(chatEl, {
    ticket, messages, mode: "user",
    onSend: async (body, _isInternal) => {
      const msg = await api.sendMessage(number, { body });
      return msg;
    },
  });

  // Read-mark на открытии.
  api.markRead(number).catch(() => {});

  // SSE live-обновление.
  const es = makeEventSource(api.userEventsUrl());
  if (es) {
    es.addEventListener("message", (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === "ticket_message" && m.ticket_number === number) {
        // Подтягиваем полное сообщение детально.
        api.getMyTicket(number).then((d) => ctrl.setMessages(d.messages)).catch(() => {});
        api.markRead(number).catch(() => {});
      } else if (m.type === "ticket_status_changed" && m.ticket_number === number) {
        metaEl.textContent = `${ticket.category.name} · ${t("support.status." + m.to)}`;
      }
    });
    // Cleanup при покидании view'а — listener на hashchange.
    const cleanup = () => {
      try { es.close(); } catch {}
      window.removeEventListener("hashchange", cleanup);
    };
    window.addEventListener("hashchange", cleanup);
  }
}


// ─── New ticket form ───────────────────────────────────────────────


export async function renderUserSupportNew({ baseUrl }) {
  let categories;
  try {
    categories = await api.listCategories();
  } catch (e) {
    setHTML(`<div class="error">${t("common.error", { msg: e.message })}</div>`);
    return;
  }

  if (!categories.length) {
    setHTML(`<div class="muted">${t("support.empty")}</div>`);
    return;
  }

  setHTML(`
    <form class="support-new" id="support-new-form">
      <label>${t("support.new.category")}
        <select name="category_slug" required>
          ${categories.map((c) =>
            `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</option>`
          ).join("")}
        </select>
      </label>
      <label>${t("support.new.title")}
        <input name="title" type="text" maxlength="160">
      </label>
      <label>${t("support.new.body")}
        <textarea name="body" required maxlength="8000"></textarea>
      </label>
      <button type="submit" class="support-new__submit">${t("support.new.submit")}</button>
    </form>
  `);

  const form = document.getElementById("support-new-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const body = {
      category_slug: fd.get("category_slug"),
      title: (fd.get("title") || "").toString().trim() || null,
      body: (fd.get("body") || "").toString().trim(),
    };
    if (!body.body) return;
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const ticket = await api.createTicket(body);
      navigate(`${baseUrl}/${ticket.number}`);
    } catch (err) {
      alert(t("common.error", { msg: err.message }));
      btn.disabled = false;
    }
  });
}


function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
