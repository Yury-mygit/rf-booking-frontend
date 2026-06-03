// Support thread: header + scroll'ящаяся лента сообщений + composer.
// Параметризуется `mode: "user" | "agent"` — у agent'а доступен toggle
// public/internal. Сама бизнес-логика отправки делегируется через
// `onSend(body, isInternal) → Promise`.
//
// Возвращает контроллер для live-обновления из SSE и imperative scroll.

import "../styles/support.css";

import { t } from "../i18n.js";

const SENDER_LABELS = {
  user: "user",
  agent: "agent",
  system: "system",
};

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit" }) +
         " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderMessage(m, mode) {
  const isMine = (mode === "user" && m.sender_kind === "user")
              || (mode === "agent" && m.sender_kind === "agent");
  const isSystem = m.sender_kind === "system";
  const isInternal = !!m.is_internal;
  const cls = [
    "sc-msg",
    isMine ? "sc-msg--mine" : "sc-msg--theirs",
    isSystem ? "sc-msg--system" : "",
    isInternal ? "sc-msg--internal" : "",
  ].filter(Boolean).join(" ");
  const meta = isInternal
    ? `<span class="sc-badge sc-badge--internal">${esc(t("support.internal_badge"))}</span>`
    : "";
  return `<div class="${cls}" data-msg-id="${m.id}">
    ${meta}
    <div class="sc-msg__body">${esc(m.body)}</div>
    <div class="sc-msg__meta">${esc(formatTime(m.created_at))}</div>
  </div>`;
}

function renderComposer(mode) {
  const placeholder = mode === "agent"
    ? t("support.composer.placeholder_agent")
    : t("support.composer.placeholder_user");
  const internalToggle = mode === "agent"
    ? `<label class="sc-toggle">
         <input type="checkbox" class="sc-internal-cb">
         <span>${esc(t("support.composer.internal"))}</span>
       </label>`
    : "";
  return `<div class="sc-composer">
    <textarea class="sc-input" placeholder="${esc(placeholder)}" rows="2"></textarea>
    <div class="sc-composer__row">
      ${internalToggle}
      <button type="button" class="sc-send">${esc(t("support.composer.send"))}</button>
    </div>
  </div>`;
}

export function mountSupportChat(container, opts) {
  const { ticket, messages, mode = "user", onSend } = opts;

  container.innerHTML = `
    <div class="sc-thread"></div>
    ${renderComposer(mode)}
  `;
  const thread = container.querySelector(".sc-thread");
  const input = container.querySelector(".sc-input");
  const sendBtn = container.querySelector(".sc-send");
  const internalCb = container.querySelector(".sc-internal-cb");

  function appendMsg(m) {
    const div = document.createElement("div");
    div.innerHTML = renderMessage(m, mode);
    thread.appendChild(div.firstElementChild);
  }

  function renderAll() {
    thread.innerHTML = "";
    for (const m of messages) appendMsg(m);
    scrollToBottom();
  }

  function scrollToBottom() {
    // Чуть отложенно — чтобы дать браузеру layout.
    requestAnimationFrame(() => {
      thread.scrollTop = thread.scrollHeight;
    });
  }

  async function doSend() {
    const body = (input.value || "").trim();
    if (!body) return;
    const isInternal = mode === "agent" && internalCb && internalCb.checked;

    sendBtn.disabled = true;
    try {
      const newMsg = await onSend(body, isInternal);
      if (newMsg) {
        messages.push(newMsg);
        appendMsg(newMsg);
        scrollToBottom();
      }
      input.value = "";
      if (internalCb) internalCb.checked = false;
    } catch (e) {
      console.error("support send failed:", e);
      // Reuse common.error — без блокирующего модала, просто алерт.
      alert(t("common.error", { msg: e.message || String(e) }));
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  sendBtn.addEventListener("click", doSend);
  input.addEventListener("keydown", (e) => {
    // Cmd/Ctrl + Enter → send. Просто Enter — перенос строки.
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      doSend();
    }
  });

  renderAll();

  // Controller для SSE live-обновления.
  return {
    addMessage(m) {
      // Идемпотентность по id — SSE может прислать то же что и POST-ответ.
      if (messages.some((x) => x.id === m.id)) return;
      messages.push(m);
      appendMsg(m);
      scrollToBottom();
    },
    setMessages(newMsgs) {
      messages.length = 0;
      messages.push(...newMsgs);
      renderAll();
    },
    focus() { input.focus(); },
    scrollToBottom,
  };
}
