// User-side support chat view (карта #92).
//
// Один экран чата на block (client/partner). Используется из
// `client/views/support.js` и `partner/views/support.js`.

import "../styles/support.css";

import { api } from "../api.js";
import { t } from "../i18n.js";
import { mountSupportChat } from "./support_chat.js";

const $app = () => document.getElementById("app");

function setHTML(html) { $app().innerHTML = html; }

function makeEventSource(url) {
  const tok = api.authToken();
  if (!tok) return null;
  const sep = url.includes("?") ? "&" : "?";
  const u = `${url}${sep}token=${encodeURIComponent(tok)}`;
  try { return new EventSource(u); } catch { return null; }
}


export async function renderUserSupportChat({ block }) {
  setHTML(`
    <div class="support-chat-screen" style="display:flex;flex-direction:column;height:calc(100dvh - var(--top-h) - var(--bn-h));">
      <div class="support-chat-head" style="padding:8px 12px;border-bottom:1px solid var(--border);font-weight:600;">
        ${t("support.title")}
      </div>
      <div id="support-chat" style="flex:1;display:flex;flex-direction:column;min-height:0;"></div>
    </div>
  `);

  const chatEl = document.getElementById("support-chat");

  // Подгружаем последние 50 сообщений (если thread есть).
  let messages = [];
  try {
    const list = await api.getMyMessages({ block, limit: 50 });
    messages = Array.isArray(list) ? list : [];
  } catch (e) {
    setHTML(`<div class="error">${t("common.error", { msg: e.message })}</div>`);
    return;
  }

  const ctrl = mountSupportChat(chatEl, {
    messages,
    mode: "user",
    onSend: async (body) => {
      const msg = await api.sendMyMessage({ block, body });
      return msg;
    },
  });

  // Read-mark при открытии (без up_to → ставит на last_message_at).
  api.markMyRead({ block }).catch(() => {});

  // SSE: новые сообщения от admin.
  const es = makeEventSource(api.userEventsUrl(block));
  if (es) {
    es.addEventListener("message", (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === "support_message") {
        // Тянем полное сообщение из API (preview обрезан).
        api.getMyMessages({ block, limit: 50 })
          .then((list) => ctrl.setMessages(list || []))
          .catch(() => {});
        api.markMyRead({ block }).catch(() => {});
      }
    });
    const cleanup = () => {
      try { es.close(); } catch {}
      window.removeEventListener("hashchange", cleanup);
    };
    window.addEventListener("hashchange", cleanup);
  }
}
