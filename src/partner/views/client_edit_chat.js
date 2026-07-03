// Partner client-edit: блок чата под формой/историей.
//
// - Список отелей берётся из bookings клиента + `client.chat_hotels` (для
//   prospect-thread'ов в hotel'ях без броней). Если у партнёра один отель —
//   без табов; если >1 — кнопки-табы.
// - Walk-in клиент (без user_id) — блок скрыт совсем.
// - SSE: один EventSource на `/p/chat/events` (все accessible_owners), фильтр
//   по hotel_id и client_user_id на стороне обработчика.

import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { escapeHtml } from "../../util.js";

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString([], {
      hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
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
  // На стороне партнёра «hotel» = «мы»; «client» = «они».
  const side = msg.sender_kind === "hotel" ? "me" : "them";
  const senderLabel =
    msg.sender_kind === "hotel" ? t("chat.sender_you") : t("chat.sender_hotel");
  // ↑ для партнёра «sender_hotel» = метка клиента; имени клиента не показываем
  //   обезличенно — для партнёра он и так известен из карточки.
  const _ = senderLabel; // suppress unused if we later switch label
  return `
    <div class="chat-msg chat-msg--${side}" data-msg-id="${msg.id}">
      <div class="chat-msg-meta">
        <span class="chat-msg-time">${escapeHtml(formatTime(msg.created_at))}</span>
        ${subjectChip(msg)}
      </div>
      <div class="chat-msg-body">${escapeHtml(msg.body)}</div>
    </div>
  `;
}

function tabsHtml(hotels, activeId) {
  if (hotels.length <= 1) return "";
  return `<div class="chat-tabs">${hotels
    .map(
      (h) =>
        `<button type="button" class="chat-tab${h.id === activeId ? " active" : ""}" data-hotel-id="${h.id}">${escapeHtml(h.name_ru)}</button>`,
    )
    .join("")}</div>`;
}

/**
 * Mount чат-блока в `container`.
 *
 * @param container HTMLElement
 * @param client    {id, user_id, ...} — для walk-in user_id=null, тогда блок не маунтится.
 * @param bookings  список истории брони клиента (для извлечения hotel-табов).
 */
export function mountClientChat(container, client, bookings) {
  if (!client.user_id) {
    container.innerHTML = "";
    return () => {};
  }
  const hotels = [];
  const seen = new Set();
  for (const b of bookings) {
    if (seen.has(b.hotel_id)) continue;
    seen.add(b.hotel_id);
    hotels.push({
      id: b.hotel_id,
      name_ru: b.hotel_name_ru,
      owner_user_id: b.hotel_owner_user_id,
    });
  }
  // Prospect-hotels: hotel'и, где у клиента есть открытый chat_thread, но нет
  // броней. Backend отдаёт их в `client.chat_hotels` (уже дедуп'нуто по
  // hotel_id против bookings — но подстрахуемся `seen`-фильтром).
  for (const h of client.chat_hotels || []) {
    if (seen.has(h.id)) continue;
    seen.add(h.id);
    hotels.push({
      id: h.id,
      name_ru: h.name_ru,
      owner_user_id: h.owner_user_id,
    });
  }

  // 6.4 read-only режим для staff без `chat_with_clients`.
  // Чтение/mark_read доступны (backend GET-ы не требуют write-perm),
  // только textarea + send блокируются с подсказкой.
  function canWrite(hotelId) {
    const h = hotels.find((x) => x.id === hotelId);
    if (!h) return false;
    const owner = api.owners().find((o) => o.owner_user_id === h.owner_user_id);
    return !!owner?.perms?.chat_with_clients;
  }
  if (!hotels.length) {
    container.innerHTML = `<p class="muted">${escapeHtml(t("chat.no_hotels"))}</p>`;
    return () => {};
  }

  let activeHotelId = hotels[0].id;
  let oldestCursor = null;
  let hasMore = false;
  let es = null;
  let aborted = false;

  function renderShell() {
    const writable = canWrite(activeHotelId);
    const readonlyBanner = writable
      ? ""
      : `<div class="chat-banner chat-banner--readonly">${escapeHtml(t("chat.readonly_no_perm"))}</div>`;
    const disabledAttr = writable ? "" : "disabled";
    container.innerHTML = `
      ${tabsHtml(hotels, activeHotelId)}
      <div class="chat-screen chat-screen--inline">
        ${readonlyBanner}
        <div class="chat-list" id="cli-chat-list">
          <p class="muted">${t("app.loading")}</p>
        </div>
        <form class="chat-composer" id="cli-chat-form" autocomplete="off">
          <textarea id="cli-chat-input" rows="1" maxlength="2000" ${disabledAttr}
            placeholder="${escapeHtml(t("chat.placeholder"))}"></textarea>
          <button type="submit" class="primary" id="cli-chat-send" ${disabledAttr}>${escapeHtml(t("chat.send"))}</button>
        </form>
      </div>
    `;
    container.querySelectorAll(".chat-tab").forEach((btn) => {
      btn.onclick = () => {
        const hid = Number(btn.dataset.hotelId);
        if (hid === activeHotelId) return;
        activeHotelId = hid;
        renderShell();
        loadInitial();
      };
    });
    const form = container.querySelector("#cli-chat-form");
    const input = container.querySelector("#cli-chat-input");
    form.onsubmit = (e) => {
      e.preventDefault();
      sendMessage(input);
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input);
      }
    });
  }

  function listEl() {
    return container.querySelector("#cli-chat-list");
  }

  function appendMessage(msg) {
    const list = listEl();
    if (!list) return;
    if (list.querySelector(`[data-msg-id="${msg.id}"]`)) return;
    const wasAtBottom =
      list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    list.insertAdjacentHTML("beforeend", messageHtml(msg));
    if (wasAtBottom) list.scrollTop = list.scrollHeight;
  }

  function prependMessage(msg) {
    const list = listEl();
    if (!list) return;
    if (list.querySelector(`[data-msg-id="${msg.id}"]`)) return;
    const prev = list.scrollHeight;
    list.insertAdjacentHTML("afterbegin", messageHtml(msg));
    list.scrollTop += list.scrollHeight - prev;
  }

  async function loadInitial() {
    const list = listEl();
    try {
      const page = await api.partnerChatListMessages(
        client.id,
        activeHotelId,
        null,
        50,
      );
      list.innerHTML = "";
      if (!page.items.length) {
        list.innerHTML = `<p class="muted chat-empty">${t("chat.empty")}</p>`;
      } else {
        for (const m of page.items.slice().reverse()) appendMessage(m);
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
      await api.partnerChatMarkRead(client.id, activeHotelId).catch(() => {});
    } catch (e) {
      list.innerHTML = `<div class="error">${t("app.error", { msg: e.message })}</div>`;
    }
  }

  async function loadOlder() {
    if (!hasMore || oldestCursor == null) return;
    const btn = listEl().querySelector(".chat-load-older");
    if (btn) btn.disabled = true;
    try {
      const page = await api.partnerChatListMessages(
        client.id,
        activeHotelId,
        oldestCursor,
        50,
      );
      for (const m of page.items.slice().reverse()) prependMessage(m);
      oldestCursor = page.next_cursor;
      hasMore = oldestCursor != null;
      if (!hasMore && btn) btn.remove();
      else if (btn) btn.disabled = false;
    } catch (e) {
      if (btn) btn.disabled = false;
      alert(t("app.error", { msg: e.message }));
    }
  }

  async function sendMessage(input) {
    if (!canWrite(activeHotelId)) return;
    const body = input.value.trim();
    if (!body) return;
    input.disabled = true;
    try {
      const msg = await api.partnerChatSendMessage(
        client.id,
        activeHotelId,
        body,
        null,
      );
      const empty = listEl().querySelector(".chat-empty");
      if (empty) empty.remove();
      appendMessage(msg);
      listEl().scrollTop = listEl().scrollHeight;
      input.value = "";
    } catch (e) {
      if (e.code === "rate_limited") alert(t("chat.rate_limited"));
      else alert(t("chat.send_error") + ": " + e.message);
    } finally {
      input.disabled = false;
      input.focus();
    }
  }

  function startSSE() {
    if (aborted) return;
    es = api.partnerChatEventSource();
    es.onmessage = (e) => {
      let payload;
      try {
        payload = JSON.parse(e.data);
      } catch {
        return;
      }
      if (payload.type !== "message") return;
      if (payload.hotel_id !== activeHotelId) return;
      if (payload.client_user_id !== client.user_id) return;
      const empty = listEl()?.querySelector(".chat-empty");
      if (empty) empty.remove();
      appendMessage(payload.msg);
      if (payload.msg.sender_kind !== "hotel") {
        api.partnerChatMarkRead(client.id, activeHotelId).catch(() => {});
      }
    };
  }

  renderShell();
  loadInitial();
  startSSE();

  return function unmount() {
    aborted = true;
    if (es) es.close();
  };
}
