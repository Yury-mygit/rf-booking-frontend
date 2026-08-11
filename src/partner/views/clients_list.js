import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { escapeHtml } from "../../util.js";
import { initialsAvatarAttrs } from "../../widgets/avatar.js";

let _es = null;
let _refetchTimer = null;

export async function renderClientsList() {
  const app = document.getElementById("app");
  app.innerHTML = `<div id="list">${t("app.loading")}</div>`;
  // Индекс client.user_id → client.id для live-обновления badge через SSE.
  let userIdToClientId = new Map();
  try {
    const clients = await api.listClients();
    const list = document.getElementById("list");
    if (!clients.length) {
      list.innerHTML = `<p class="muted">${t("clients.empty")}</p>`;
      return;
    }
    list.innerHTML = clients.map(cardHtml).join("");
    attachCardHandlers(list);
    for (const c of clients) {
      if (c.user_id) userIdToClientId.set(c.user_id, c.id);
    }
  } catch (e) {
    document.getElementById("list").innerHTML =
      `<div class="error">${t("app.error", { msg: e.message })}</div>`;
    return;
  }

  if (_es) { try { _es.close(); } catch {} _es = null; }
  if (_refetchTimer) { clearTimeout(_refetchTimer); _refetchTimer = null; }
  _es = api.partnerChatEventSource();
  _es.onmessage = (e) => {
    let p;
    try { p = JSON.parse(e.data); } catch { return; }
    if (p.type !== "message") return;
    // Бейдж нужен только если новое сообщение пришло от клиента (нашему отелю).
    if (p.msg.sender_kind !== "client") return;
    const cid = userIdToClientId.get(p.client_user_id);
    if (!cid) {
      // Новый prospect не в списке — batched refetch. Дальнейшие события
      // от других unknown user_id за окно 500мс сольются в один refetch.
      if (_refetchTimer) clearTimeout(_refetchTimer);
      _refetchTimer = setTimeout(() => { _refetchTimer = null; renderClientsList(); }, 500);
      return;
    }
    const card = document.querySelector(`.clickable-card[data-href="#/partner/client/${cid}"]`);
    if (!card) return;
    if (!card.querySelector(".chat-unread-badge")) {
      card.querySelector(".hotel-row-body h3")?.insertAdjacentHTML(
        "beforeend",
        ` <span class="chat-unread-badge" aria-label="${escapeHtml(t("chat.unread_badge"))}" title="${escapeHtml(t("chat.unread_badge"))}"></span>`,
      );
    }
  };

  window.addEventListener("hashchange", function once() {
    if (_es) { try { _es.close(); } catch {} _es = null; }
    if (_refetchTimer) { clearTimeout(_refetchTimer); _refetchTimer = null; }
    window.removeEventListener("hashchange", once);
  });
}

function cardHtml(c) {
  let photo;
  if (c.photo_url) {
    photo = `<div class="hotel-thumb" style="background-image:url('${escapeHtml(c.photo_url)}')"></div>`;
  } else {
    const a = initialsAvatarAttrs(c.first_name, c.last_name);
    photo = `<div class="hotel-thumb ${a.className}" style="${a.style}">${a.initials}</div>`;
  }
  const name = [c.first_name, c.last_name].filter(Boolean).map(escapeHtml).join(" ");
  const contact = c.phone || c.email || t("clients.no_phone");
  const badge = c.has_unread_chat
    ? ` <span class="chat-unread-badge" aria-label="${escapeHtml(t("chat.unread_badge"))}" title="${escapeHtml(t("chat.unread_badge"))}"></span>`
    : "";
  const metaLine = c.is_prospect
    ? `<span class="status-pill prospect">${escapeHtml(t("clients.chat_only_badge"))}</span>`
    : `${t("clients.bookings_count", { n: c.bookings_count })}${c.last_booking_date ? " · " + t("clients.last_booking", { date: c.last_booking_date }) : ""}`;
  return `
    <div class="card hotel-row clickable-card" data-href="#/partner/client/${c.id}" role="link" tabindex="0">
      ${photo}
      <div class="hotel-row-body">
        <h3>${name}${badge}</h3>
        <div class="meta">${escapeHtml(contact)}</div>
        <div class="meta small">${metaLine}</div>
      </div>
    </div>`;
}

function attachCardHandlers(container) {
  container.addEventListener("click", (e) => {
    if (e.target.closest("a, button")) return;
    const card = e.target.closest(".clickable-card");
    if (!card) return;
    location.hash = card.dataset.href;
  });
  container.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".clickable-card");
    if (!card) return;
    e.preventDefault();
    location.hash = card.dataset.href;
  });
}
