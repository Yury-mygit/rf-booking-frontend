// Admin support: список thread'ов (карта #92).
//
// Каждая карточка = (user × block). Сортировка по last_message_at DESC,
// unread-badge. Тап → #/admin/support/<thread_id>.

import "../../../styles/support.css";

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { navigate } from "../../../router.js";

const $app = () => document.getElementById("app");

function setHTML(html) { $app().innerHTML = html; }

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function userTitle(u) {
  const name = `${u.first_name || ""} ${u.last_name || ""}`.trim();
  return name || u.username || `id:${u.telegram_id}`;
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
}

function renderRow(thread) {
  const unread = thread.unread_count > 0;
  const blockLabel = thread.block === "client"
    ? t("support.block.client")
    : t("support.block.partner");
  const badge = unread
    ? `<span class="sl-badge">${thread.unread_count}</span>`
    : "";
  return `
    <div class="sl-row${unread ? " sl-row--unread" : ""}" data-id="${thread.id}">
      <div class="sl-row__main">
        <div class="sl-row__title">
          <span class="sl-row__user">${esc(userTitle(thread.user))}</span>
          <span class="sl-row__block">[${esc(blockLabel)}]</span>
        </div>
        <div class="sl-row__preview">${esc(thread.last_message_preview || t("support.empty_preview"))}</div>
      </div>
      <div class="sl-row__side">
        <div class="sl-row__time">${esc(formatTime(thread.last_message_at))}</div>
        ${badge}
      </div>
    </div>
  `;
}

export async function renderAdminSupportList() {
  setHTML(`
    <div class="support-list-screen">
      <div class="support-list" id="support-list">
        <div class="muted">${t("common.loading")}</div>
      </div>
    </div>
  `);

  const listEl = document.getElementById("support-list");

  async function load() {
    try {
      const items = await api.adminListThreads({ limit: 50 });
      if (!items.length) {
        listEl.innerHTML = `<div class="support-list__empty">${t("support.empty")}</div>`;
        return;
      }
      listEl.innerHTML = items.map(renderRow).join("");
      listEl.querySelectorAll(".sl-row").forEach((el) => {
        el.addEventListener("click", () => {
          navigate(`/admin/support/${el.dataset.id}`);
        });
      });
    } catch (e) {
      listEl.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    }
  }

  await load();

  // SSE: на любое событие — refresh списка (мини-debounce).
  const tok = api.authToken();
  if (!tok) return;
  const url = api.adminEventsUrl() + `?token=${encodeURIComponent(tok)}`;
  let es;
  try { es = new EventSource(url); } catch { return; }
  let timer = null;
  es.addEventListener("message", () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      load();
    }, 600);
  });
  const cleanup = () => {
    try { es.close(); } catch {}
    if (timer) clearTimeout(timer);
    window.removeEventListener("hashchange", cleanup);
  };
  window.addEventListener("hashchange", cleanup);
}
