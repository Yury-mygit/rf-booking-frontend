// Admin Support Thread view: chat (с public/internal toggle) + side-panel
// контекста юзера + quick-actions (claim/release/status/priority/category)
// + audit feed (collapsible).
//
// Layout: на мобиле — стек (header → side-panel collapsed → chat → composer).
// На широком экране — две колонки.

import "../../../styles/support.css";

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { navigate } from "../../../router.js";
import { mountSupportChat } from "../../../widgets/support_chat.js";
import { renderUserContext } from "../../../widgets/support_user_context.js";

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

const STATUS_TRANSITIONS = ["open", "pending_admin", "pending_user", "resolved", "closed"];
const PRIORITIES = ["low", "normal", "high", "urgent"];


export async function renderAdminSupportThread(number) {
  const root = document.getElementById("app");
  root.innerHTML = `<div class="muted" style="padding:16px">${t("common.loading")}</div>`;

  let data;
  try {
    data = await api.adminGetTicket(number);
  } catch (e) {
    root.innerHTML = `<div class="error">${esc(t("common.error", { msg: e.message }))}</div>`;
    return;
  }
  const ticket = data.ticket;
  const messages = data.messages;

  // Подгружаем теги и категории для admin actions.
  const [allCats, allTags] = await Promise.all([
    api.adminListCategories().catch(() => []),
    api.adminListTags().catch(() => []),
  ]);

  root.innerHTML = `
    <div class="ast">
      <div class="ast__head">
        <button class="ast__back" type="button">‹ ${esc(t("common.back"))}</button>
        <div class="ast__title">
          <strong>${esc(ticket.number)}</strong>
          <span class="muted">${esc(ticket.category.name_ru || ticket.category.slug)}</span>
        </div>
        <div class="ast__meta">
          <span class="support-card__status">${esc(t("support.status." + ticket.status))}</span>
          <span title="${esc(ticket.priority)}">${priorityDot(ticket.priority)} ${esc(t("support.priority." + ticket.priority))}</span>
          ${ticket.assignee ? `<span>→ @${esc(ticket.assignee.username || ticket.assignee.first_name || "")}</span>` : `<span class="muted">${esc(t("support.unassigned"))}</span>`}
        </div>
      </div>

      <div class="ast__actions">
        <button class="ast__act" data-act="claim">${esc(t("support.actions.claim_me"))}</button>
        <button class="ast__act" data-act="release">${esc(t("support.actions.release"))}</button>
        <select class="ast__sel" data-field="status">
          ${STATUS_TRANSITIONS.map((s) =>
            `<option value="${s}"${s === ticket.status ? " selected" : ""}>${esc(t("support.status." + s))}</option>`
          ).join("")}
        </select>
        <select class="ast__sel" data-field="priority">
          ${PRIORITIES.map((p) =>
            `<option value="${p}"${p === ticket.priority ? " selected" : ""}>${esc(t("support.priority." + p))}</option>`
          ).join("")}
        </select>
        <select class="ast__sel" data-field="category">
          ${allCats.map((c) =>
            `<option value="${esc(c.slug)}"${c.slug === ticket.category.slug ? " selected" : ""}>${esc(c.name_ru)}</option>`
          ).join("")}
        </select>
        <select class="ast__sel" data-field="tag-add">
          <option value="">${esc(t("support.filters.tag"))} +</option>
          ${allTags.map((tg) => `<option value="${tg.id}">${esc(tg.name)}</option>`).join("")}
        </select>
      </div>

      <div class="ast__body">
        <aside class="ast__side" id="ast-side"></aside>
        <section class="ast__chat" id="ast-chat" style="flex:1;display:flex;flex-direction:column;min-height:0;"></section>
      </div>

      <details class="ast__audit">
        <summary>${esc(t("support.audit"))}</summary>
        <div id="ast-events" class="muted" style="padding:8px">${esc(t("common.loading"))}</div>
      </details>
    </div>
  `;

  // Back via TG/in-app — переход в inbox.
  root.querySelector(".ast__back").addEventListener("click", () => navigate("#/admin/support"));

  // Side-panel.
  renderUserContext(document.getElementById("ast-side"), {
    user: ticket.user,
    currentTicketNumber: ticket.number,
  });

  // Chat.
  const ctrl = mountSupportChat(document.getElementById("ast-chat"), {
    ticket, messages, mode: "agent",
    onSend: async (body, isInternal) => {
      return await api.adminSendMessage(number, { body, is_internal: !!isInternal });
    },
  });

  // Read-mark.
  api.adminMarkRead(number).catch(() => {});

  // Actions.
  root.querySelectorAll(".ast__act").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const act = btn.dataset.act;
      try {
        if (act === "claim") await api.adminClaim(number);
        else if (act === "release") await api.adminRelease(number);
        await refreshHead();
      } catch (e) {
        alert(t("common.error", { msg: e.message }));
      }
    });
  });
  root.querySelectorAll(".ast__sel").forEach((sel) => {
    sel.addEventListener("change", async () => {
      const field = sel.dataset.field;
      try {
        if (field === "status") {
          await api.adminPatchTicket(number, { status: sel.value });
        } else if (field === "priority") {
          await api.adminPatchTicket(number, { priority: sel.value });
        } else if (field === "category") {
          await api.adminPatchTicket(number, { category_slug: sel.value });
        } else if (field === "tag-add" && sel.value) {
          await api.adminAddTag(number, Number(sel.value));
          sel.value = "";
        }
        await refreshHead();
      } catch (e) {
        alert(t("common.error", { msg: e.message }));
      }
    });
  });

  // Audit feed — раскрывается по details.
  root.querySelector(".ast__audit").addEventListener("toggle", async (e) => {
    if (!e.target.open) return;
    const eventsEl = document.getElementById("ast-events");
    try {
      const events = await api.adminListEvents(number);
      eventsEl.innerHTML = events.length
        ? events.map(renderEvent).join("")
        : `<span class="muted">${esc(t("support.audit.empty"))}</span>`;
    } catch (err) {
      eventsEl.innerHTML = `<span class="error">${esc(err.message)}</span>`;
    }
  }, { once: false });

  async function refreshHead() {
    try {
      const d = await api.adminGetTicket(number);
      const t1 = d.ticket;
      const headStatus = root.querySelector(".ast__meta .support-card__status");
      if (headStatus) headStatus.textContent = t("support.status." + t1.status);
    } catch {}
  }

  // SSE: подхватывать live-сообщения и status changes именно этого тикета.
  const es = makeEventSource(api.adminEventsUrl());
  if (es) {
    es.addEventListener("message", (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.ticket_number !== number) return;
      if (m.type === "ticket_message") {
        // Запросим заново — простой путь, без частичной отрисовки.
        api.adminGetTicket(number).then((d) => ctrl.setMessages(d.messages)).catch(() => {});
        api.adminMarkRead(number).catch(() => {});
      } else if (m.type === "ticket_status_changed" || m.type === "ticket_meta_changed") {
        refreshHead();
      }
    });
    const cleanup = () => {
      try { es.close(); } catch {}
      window.removeEventListener("hashchange", cleanup);
    };
    window.addEventListener("hashchange", cleanup);
  }
}


function priorityDot(p) {
  return { low: "⚪", normal: "🟢", high: "🟡", urgent: "🔴" }[p] || "⚪";
}

function renderEvent(e) {
  const tagKey = "support.events." + e.kind;
  const actor = e.actor
    ? `@${esc(e.actor.username || e.actor.first_name || "")}`
    : esc(t("support.events.system"));
  let body = "";
  if (e.kind === "tag_added" || e.kind === "tag_removed") {
    body = t(tagKey, { tag: e.payload?.tag_name || "" });
  } else if (["status_changed", "assignee_changed", "priority_changed", "category_changed"].includes(e.kind)) {
    body = t(tagKey, {
      from: String(e.payload?.from ?? "—"),
      to: String(e.payload?.to ?? "—"),
    });
  } else {
    body = t(tagKey);
  }
  const ts = new Date(e.created_at).toLocaleString();
  return `<div class="ast__event"><span class="muted">${esc(ts)} · ${actor}</span> ${esc(body)}</div>`;
}
