// Chat thread view: лента сообщений + textarea + send + SSE-подписка.
//
// Subject (room/booking/hotel) хранится локально в state.pendingSubject —
// сетится на entry-point (карточка комнаты/брони/view отеля), attach'ится
// к первому отправленному сообщению, потом сбрасывается. В URL subject
// не пробрасываем — после reload это просто переписка.
//
// Realtime: EventSource на /c/chat/events; токен через query (EventSource
// не поддерживает Authorization header). Фильтр по thread_id на стороне
// handler'а.

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { navigate } from "../../../router.js";
import { setTitle, showBack } from "../../../topbar.js";
import { setBottomNav } from "../../../bottomnav.js";
import { getChatReturnHash, takePendingSubject } from "../../state.js";

function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

// Sticky-карточка сверху диалога: показывается только если на entry-point
// был subject (room/booking). Тап → переход на entity-view (Этап 5.6).
// Для type=hotel карточку не показываем — отель уже в заголовке экрана.
function subjectCardHtml(subj) {
  if (!subj || subj.type === "hotel") return "";
  const photo = subj.photo
    ? `<img class="chat-subject-photo" src="${escapeHtml(subj.photo)}" alt="">`
    : `<div class="chat-subject-photo chat-subject-photo--placeholder"></div>`;
  const name = escapeHtml(subj.name || (subj.type === "booking" ? t("chat.subject_booking_default") : t("chat.subject_room_default")));
  const extra = subj.extra ? `<div class="chat-subject-extra">${escapeHtml(subj.extra)}</div>` : "";
  return `
    <button type="button" class="chat-subject-card" id="chat-subject-card">
      ${photo}
      <div class="chat-subject-text">
        <div class="chat-subject-name">${name}</div>
        ${extra}
      </div>
    </button>
  `;
}

function subjectNavTarget(subj) {
  if (!subj) return null;
  if (subj.type === "booking") return "#/client/bookings";
  if (subj.type === "room" && subj.hotel_slug)
    return `#/client/hotel/${encodeURIComponent(subj.hotel_slug)}/rooms`;
  if (subj.type === "hotel" && subj.hotel_slug)
    return `#/client/hotel/${encodeURIComponent(subj.hotel_slug)}`;
  return null;
}

function botBlockedBannerHtml(me) {
  if (!me || !me.bot_blocked_or_unreachable) return "";
  return `<div class="chat-banner chat-banner--warn">${escapeHtml(t("chat.bot_blocked_banner"))}</div>`;
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString([], {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    return "";
  }
}

function subjectChip(msg) {
  if (!msg.subject_type) return "";
  if (msg.subject_type === "booking") {
    return `<span class="chat-chip">${escapeHtml(t("chat.subject_booking", { n: msg.subject_id }))}</span>`;
  }
  if (msg.subject_type === "room") {
    return `<span class="chat-chip">${escapeHtml(t("chat.subject_room"))}</span>`;
  }
  if (msg.subject_type === "hotel") {
    return `<span class="chat-chip">${escapeHtml(t("chat.subject_hotel"))}</span>`;
  }
  return "";
}

function messageHtml(msg) {
  const side = msg.sender_kind === "client" ? "me" : "them";
  const senderLabel =
    msg.sender_kind === "client" ? t("chat.sender_you") : t("chat.sender_hotel");
  return `
    <div class="chat-msg chat-msg--${side}" data-msg-id="${msg.id}">
      <div class="chat-msg-meta">
        <span class="chat-msg-sender">${escapeHtml(senderLabel)}</span>
        <span class="chat-msg-time">${escapeHtml(formatTime(msg.created_at))}</span>
        ${subjectChip(msg)}
      </div>
      <div class="chat-msg-body">${escapeHtml(msg.body)}</div>
    </div>
  `;
}

export async function renderChatThread({ threadId }) {
  const app = document.getElementById("app");
  app.innerHTML = `<p>${t("common.loading")}</p>`;

  if (!api.hasToken()) {
    app.innerHTML = `<p class="muted">${t("my.need_auth")} <a href="#/client/login">${t("my.dev_login")}</a></p>`;
    return;
  }

  const tid = Number(threadId);
  let pendingSubject = takePendingSubject();
  let allThreads = null;
  let thread = null;
  let me = null;
  try {
    [allThreads, me] = await Promise.all([
      api.chatListThreads(),
      api.whoami().catch(() => null),
    ]);
    thread = allThreads.find((t) => t.id === tid);
    if (!thread) throw new Error("Thread not found");
  } catch (e) {
    app.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    return;
  }

  setTitle(t("chat.title_with_hotel", { hotel: thread.hotel.name_ru }));
  const returnHash = getChatReturnHash() || "#/client/bookings";
  showBack(() => navigate(returnHash));
  setBottomNav([]);

  app.innerHTML = `
    <div class="chat-screen">
      ${botBlockedBannerHtml(me)}
      ${subjectCardHtml(pendingSubject)}
      <div class="chat-list" id="chat-list">
        <p class="muted">${t("common.loading")}</p>
      </div>
      <form class="chat-composer" id="chat-form" autocomplete="off">
        <textarea id="chat-input" rows="1" maxlength="2000"
          placeholder="${escapeHtml(t("chat.placeholder"))}"></textarea>
        <button type="submit" class="primary" id="chat-send">${escapeHtml(t("chat.send"))}</button>
      </form>
    </div>
  `;

  const subjectCard = document.getElementById("chat-subject-card");
  if (subjectCard) {
    const target = subjectNavTarget(pendingSubject);
    if (target) {
      subjectCard.addEventListener("click", () => navigate(target));
    } else {
      subjectCard.disabled = true;
    }
  }

  const list = document.getElementById("chat-list");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");

  // Загрузка сообщений: сервер отдаёт desc (новые сверху). Разворачиваем
  // для отображения «снизу — новые».
  let oldestCursor = null;
  let hasMore = false;

  function appendMessage(msg) {
    if (list.querySelector(`[data-msg-id="${msg.id}"]`)) return;
    const wasAtBottom =
      list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    list.insertAdjacentHTML("beforeend", messageHtml(msg));
    if (wasAtBottom) list.scrollTop = list.scrollHeight;
  }

  function prependMessage(msg) {
    if (list.querySelector(`[data-msg-id="${msg.id}"]`)) return;
    const prevHeight = list.scrollHeight;
    list.insertAdjacentHTML("afterbegin", messageHtml(msg));
    list.scrollTop += list.scrollHeight - prevHeight;
  }

  async function loadInitial() {
    try {
      const page = await api.chatListMessages(tid, null, 50);
      list.innerHTML = "";
      if (!page.items.length) {
        list.innerHTML = `<p class="muted chat-empty">${t("chat.empty")}</p>`;
      } else {
        const items = page.items.slice().reverse();
        for (const m of items) appendMessage(m);
      }
      oldestCursor = page.next_cursor;
      hasMore = oldestCursor != null;
      if (hasMore) {
        list.insertAdjacentHTML(
          "afterbegin",
          `<button class="chat-load-older" type="button">${escapeHtml(t("chat.load_older"))}</button>`,
        );
        list.querySelector(".chat-load-older").onclick = loadOlder;
      }
      list.scrollTop = list.scrollHeight;
      await api.chatMarkRead(tid).catch(() => {});
    } catch (e) {
      list.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    }
  }

  async function loadOlder() {
    if (!hasMore || oldestCursor == null) return;
    const btn = list.querySelector(".chat-load-older");
    if (btn) btn.disabled = true;
    try {
      const page = await api.chatListMessages(tid, oldestCursor, 50);
      // Items идут от новых к старым; внутри страницы порядок «новый→старый»,
      // нам нужно вставить их перед существующими в порядке «старый→новый».
      const items = page.items.slice().reverse();
      for (const m of items) prependMessage(m);
      oldestCursor = page.next_cursor;
      hasMore = oldestCursor != null;
      if (!hasMore && btn) btn.remove();
      else if (btn) btn.disabled = false;
    } catch (e) {
      if (btn) btn.disabled = false;
      alert(t("common.error", { msg: e.message }));
    }
  }

  async function sendMessage() {
    const body = input.value.trim();
    if (!body) return;
    input.disabled = true;
    try {
      const msg = await api.chatSendMessage(tid, body, pendingSubject);
      pendingSubject = null;
      const empty = list.querySelector(".chat-empty");
      if (empty) empty.remove();
      appendMessage(msg);
      list.scrollTop = list.scrollHeight;
      input.value = "";
    } catch (e) {
      if (e.code === "rate_limited") {
        alert(t("chat.rate_limited"));
      } else {
        alert(t("chat.send_error") + ": " + e.message);
      }
    } finally {
      input.disabled = false;
      input.focus();
    }
  }

  form.onsubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // SSE: подписываемся на канал клиента, фильтруем по thread_id.
  let es = null;
  let aborted = false;
  function startSSE() {
    if (aborted) return;
    es = api.chatEventSource();
    es.onmessage = (e) => {
      let payload;
      try {
        payload = JSON.parse(e.data);
      } catch {
        return;
      }
      if (payload.type !== "message") return;
      if (payload.thread_id !== tid) return;
      const empty = list.querySelector(".chat-empty");
      if (empty) empty.remove();
      appendMessage(payload.msg);
      if (payload.msg.sender_kind !== "client") {
        api.chatMarkRead(tid).catch(() => {});
      }
    };
    es.onerror = () => {
      // EventSource сам пытается реконнект. Закрываем только при unmount.
    };
  }

  // Cleanup при смене hash — слушаем разово.
  function cleanup() {
    aborted = true;
    if (es) es.close();
    window.removeEventListener("hashchange", cleanup);
  }
  window.addEventListener("hashchange", cleanup);

  await loadInitial();
  startSSE();
}
