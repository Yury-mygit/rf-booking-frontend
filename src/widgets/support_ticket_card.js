// Карточка тикета для list-view. Используется и в client/partner SPA,
// и в admin Inbox — отличия параметризуются `mode`.
//
// Возвращает DOM-элемент. Сам не вешает click — callback'ом.

import { t } from "../i18n.js";

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const ms = now - d;
  if (ms < 36 * 3600 * 1000) return t("support.time.yesterday");
  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
}

const PRIORITY_DOT = {
  low: "⚪",
  normal: "🟢",
  high: "🟡",
  urgent: "🔴",
};

const STATUS_KEY = (s) => `support.status.${s}`;

export function renderTicketCard(item, mode) {
  const div = document.createElement("div");
  div.className = `support-card support-card--${mode}` + (item.unread ? " is-unread" : "");
  div.dataset.number = item.number;

  const previewBlock = item.last_message_preview
    ? `<div class="support-card__preview">${esc(item.last_message_preview)}</div>`
    : "";

  const userBlock = mode === "agent" && item.user
    ? `<div class="support-card__user">
         ${esc(item.user.first_name || "")} ${esc(item.user.last_name || "")}
         <span class="support-card__role">[${esc(item.user.role)}]</span>
       </div>`
    : "";

  const priorityBlock = mode === "agent"
    ? `<span class="support-card__priority" title="${esc(item.priority)}">
         ${PRIORITY_DOT[item.priority] || "⚪"}
       </span>`
    : "";

  const tagBlock = mode === "agent" && item.tags && item.tags.length
    ? `<div class="support-card__tags">
         ${item.tags.map((tg) =>
           `<span class="support-tag" style="background:${esc(tg.color)}">${esc(tg.name)}</span>`
         ).join("")}
       </div>`
    : "";

  const overdueBlock = mode === "agent" && item.is_overdue
    ? `<span class="support-card__overdue">${esc(t("support.overdue"))}</span>`
    : "";

  const assigneeBlock = mode === "agent" && item.assignee
    ? `<span class="support-card__assignee">@${esc(item.assignee.username || item.assignee.first_name || "")}</span>`
    : mode === "agent"
    ? `<span class="support-card__unassigned">${esc(t("support.unassigned"))}</span>`
    : "";

  div.innerHTML = `
    <div class="support-card__head">
      ${item.unread ? '<span class="support-card__dot"></span>' : ""}
      <span class="support-card__num">${esc(item.number)}</span>
      <span class="support-card__cat">${esc(item.category.name)}</span>
      ${priorityBlock}
      <span class="support-card__time">${esc(formatTime(item.last_message_at))}</span>
    </div>
    ${userBlock}
    ${item.title ? `<div class="support-card__title">${esc(item.title)}</div>` : ""}
    ${previewBlock}
    <div class="support-card__foot">
      <span class="support-card__status">${esc(t(STATUS_KEY(item.status)))}</span>
      ${overdueBlock}
      ${assigneeBlock}
      ${tagBlock}
    </div>
  `;

  return div;
}
