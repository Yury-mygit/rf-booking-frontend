// Support chat widget (карта #92): scrollable thread + composer.
//
// `mode: "user" | "admin"` — определяет какие сообщения считаются "mine"
// (для класса .sc-msg--mine). Sender_kind в данных — "user" | "admin".
// onSend(body) → Promise<msg>.

import "../styles/support.css";

import { t } from "../i18n.js";

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
  const isMine = m.sender_kind === mode;
  const cls = ["sc-msg", isMine ? "sc-msg--mine" : "sc-msg--theirs"]
    .join(" ");
  return `<div class="${cls}" data-msg-id="${m.id}">
    <div class="sc-msg__body">${esc(m.body)}</div>
    <div class="sc-msg__meta">${esc(formatTime(m.created_at))}</div>
  </div>`;
}

function renderComposer() {
  return `<div class="sc-composer">
    <textarea class="sc-input" placeholder="${esc(t("support.composer.placeholder"))}" rows="2"></textarea>
    <div class="sc-composer__row">
      <button type="button" class="sc-send">${esc(t("support.composer.send"))}</button>
    </div>
  </div>`;
}

export function mountSupportChat(container, opts) {
  const { messages, mode = "user", onSend } = opts;

  container.innerHTML = `
    <div class="sc-thread"></div>
    ${renderComposer()}
  `;
  const thread = container.querySelector(".sc-thread");
  const input = container.querySelector(".sc-input");
  const sendBtn = container.querySelector(".sc-send");

  function appendMsg(m) {
    const div = document.createElement("div");
    div.innerHTML = renderMessage(m, mode);
    thread.appendChild(div.firstElementChild);
  }

  function renderAll() {
    thread.innerHTML = "";
    // Backend отдаёт newest first; для UI разворачиваем oldest→newest.
    const ordered = [...messages].sort((a, b) => a.id - b.id);
    messages.length = 0;
    messages.push(...ordered);
    for (const m of messages) appendMsg(m);
    scrollToBottom();
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      thread.scrollTop = thread.scrollHeight;
    });
  }

  async function doSend() {
    const body = (input.value || "").trim();
    if (!body) return;
    sendBtn.disabled = true;
    try {
      const newMsg = await onSend(body);
      if (newMsg) addMessage(newMsg);
      input.value = "";
    } catch (e) {
      console.error("support send failed:", e);
      alert(t("common.error", { msg: e.message || String(e) }));
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  function addMessage(m) {
    if (messages.some((x) => x.id === m.id)) return;
    messages.push(m);
    appendMsg(m);
    scrollToBottom();
  }

  sendBtn.addEventListener("click", doSend);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      doSend();
    }
  });

  renderAll();

  return {
    addMessage,
    setMessages(newMsgs) {
      messages.length = 0;
      messages.push(...newMsgs);
      renderAll();
    },
    focus() { input.focus(); },
    scrollToBottom,
  };
}
