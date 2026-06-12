// Admin support: чат с одним thread'ом (карта #92).

import "../../../styles/support.css";

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { mountSupportChat } from "../../../widgets/support_chat.js";

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

function makeEventSource(url) {
  const tok = api.authToken();
  if (!tok) return null;
  const sep = url.includes("?") ? "&" : "?";
  const u = `${url}${sep}token=${encodeURIComponent(tok)}`;
  try { return new EventSource(u); } catch { return null; }
}

export async function renderAdminSupportThread(threadId) {
  const id = Number(threadId);
  setHTML(`
    <div class="support-chat-screen" style="display:flex;flex-direction:column;height:calc(100dvh - var(--top-h) - var(--bn-h));">
      <div class="support-chat-head" id="support-head" style="padding:8px 12px;border-bottom:1px solid var(--border);"></div>
      <div id="support-chat" style="flex:1;display:flex;flex-direction:column;min-height:0;"></div>
    </div>
  `);

  const headEl = document.getElementById("support-head");
  const chatEl = document.getElementById("support-chat");

  let thread;
  let messages = [];
  try {
    thread = await api.adminGetThread(id);
    const list = await api.adminGetMessages(id, { limit: 50 });
    messages = Array.isArray(list) ? list : [];
  } catch (e) {
    setHTML(`<div class="error">${t("common.error", { msg: e.message })}</div>`);
    return;
  }

  const blockLabel = thread.block === "client"
    ? t("support.block.client")
    : t("support.block.partner");
  headEl.innerHTML = `
    <div style="font-weight:600">${esc(userTitle(thread.user))} <span class="muted">[${esc(blockLabel)}]</span></div>
  `;

  const ctrl = mountSupportChat(chatEl, {
    messages,
    mode: "admin",
    onSend: async (body) => {
      const msg = await api.adminSendMessage(id, { body });
      return msg;
    },
  });

  api.adminMarkRead(id, {}).catch(() => {});

  const es = makeEventSource(api.adminEventsUrl());
  if (es) {
    es.addEventListener("message", (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === "support_message" && m.thread_id === id) {
        api.adminGetMessages(id, { limit: 50 })
          .then((list) => ctrl.setMessages(list || []))
          .catch(() => {});
        api.adminMarkRead(id, {}).catch(() => {});
      }
    });
    const cleanup = () => {
      try { es.close(); } catch {}
      window.removeEventListener("hashchange", cleanup);
    };
    window.addEventListener("hashchange", cleanup);
  }
}
