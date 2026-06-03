// Side-panel для admin drawer'а: профиль юзера + активные брони + прошлые
// тикеты этого юзера. Используется только в admin Support thread view.

import { api } from "../api.js";
import { t } from "../i18n.js";

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

export async function renderUserContext(container, { user, currentTicketNumber }) {
  container.innerHTML = `
    <div class="suc">
      <div class="suc__head">
        <strong>${esc(user.first_name || "")} ${esc(user.last_name || "")}</strong>
        <div class="muted" style="font-size:12px">
          @${esc(user.username || "—")} · TG ${esc(user.telegram_id)}
        </div>
        <div class="muted" style="font-size:12px">
          ${esc(t("support.user_context.role"))}: ${esc(user.role)}
        </div>
      </div>
      <div class="suc__section">
        <div class="suc__label">${esc(t("support.user_context.tickets"))}</div>
        <div class="suc__list" id="suc-tickets">${esc(t("common.loading"))}</div>
      </div>
    </div>
  `;

  const ticketsEl = document.getElementById("suc-tickets");
  try {
    // Получим все тикеты с фильтром по assignee_id отсутствует — поэтому
    // используем admin search по user.id напрямую через полный список (v1).
    // Простой workaround: фильтр через ?q на user.id, но q ищет по имени.
    // Поэтому скачиваем все active+archive и фильтруем на клиенте.
    const both = await Promise.all([
      api.adminListTickets({ view: "active", limit: 200 }).catch(() => ({ items: [] })),
      api.adminListTickets({ view: "archive", limit: 100 }).catch(() => ({ items: [] })),
    ]);
    const all = [...(both[0].items || []), ...(both[1].items || [])]
      .filter((t) => t.user && t.user.id === user.id)
      .filter((t) => t.number !== currentTicketNumber)
      .slice(0, 10);

    if (!all.length) {
      ticketsEl.innerHTML = `<span class="muted">—</span>`;
      return;
    }
    ticketsEl.innerHTML = all.map((it) => `
      <a class="suc__item" href="#/admin/support/${esc(it.number)}">
        <span class="suc__num">${esc(it.number)}</span>
        <span class="suc__status">${esc(t("support.status." + it.status))}</span>
      </a>
    `).join("");
  } catch (e) {
    ticketsEl.innerHTML = `<span class="error">${esc(e.message)}</span>`;
  }
}
