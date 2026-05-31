// Rooms screen — список комнат + filters (даты/гости) + SSE-refresh при
// серверных push'ах. Кнопка «Забронировать» уводит на /book/<roomId>.

import { api } from "../../../api.js";
import { getLang, t } from "../../../i18n.js";
import { navigate, getQuery } from "../../../router.js";
import { setTitle, showBack } from "../../../topbar.js";
import { setBottomNav } from "../../../bottomnav.js";
import { mountDateRange } from "../../../widgets/daterange.js";
import { setLastHotel } from "../../state.js";
import { clientNavItems } from "../../nav.js";

import { _state, ensureHotel, ensureEventSource, escapeHtml, hotelHash } from "./_shared.js";
import { CHAT_ICON_SVG, openChatWithHotel } from "../chat/open.js";

export async function renderHotelRooms({ id }) {
  const app = document.getElementById("app");
  app.innerHTML = `<p>${t("common.loading")}</p>`;
  const q = getQuery();
  _state.query = q;
  _state.guestsFilter = Number(q.guests) || 1;
  let h;
  try {
    h = await ensureHotel(id, q);
  } catch (e) {
    app.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    return;
  }
  setTitle(t("client.nav.rooms"));
  showBack(() => navigate(hotelHash(h)));
  setBottomNav(clientNavItems("hotel"));
  app.innerHTML = `<div id="rooms-section"></div>`;
  renderRoomsList(document.getElementById("rooms-section"));
}

function renderRoomsList(body) {
  const h = _state.hotel;
  const q = _state.query;
  const g = _state.guestsFilter;
  const hasDates = q.check_in && q.check_out;
  const rooms = (h.rooms || []).filter((r) => r.capacity >= g);
  body.innerHTML = `
    <div class="rooms-controls">
      <div class="filters-row">
        <div class="filter-cell filter-cell--dates">
          <div id="f-dates"></div>
        </div>
        <div class="filter-cell filter-cell--guests">
          <label for="f-guests">${t("rooms.filter.guests")}</label>
          <input id="f-guests" type="number" min="1" max="20" value="${g}" />
        </div>
      </div>
    </div>
    ${!hasDates ? `<p class="muted">${t("rooms.no_dates")}</p>` : ""}
    <div id="rooms-list">
      ${rooms.length === 0
        ? `<p class="muted">${t("rooms.empty_filter")}</p>`
        : rooms.map((r) => roomCardHtml(r, hasDates)).join("")}
    </div>
  `;
  mountDateRange(document.getElementById("f-dates"), {
    start: q.check_in || null,
    end: q.check_out || null,
    lang: getLang(),
    labelIn: t("rooms.check_in"),
    labelOut: t("rooms.check_out"),
    placeholderIn: t("rooms.pick_date"),
    placeholderOut: t("rooms.pick_date"),
    onChange: (start, end) => updateRangeDates(body, start, end),
  });
  document.getElementById("f-guests").onchange = (e) => {
    _state.guestsFilter = Number(e.target.value) || 1;
    _state.query.guests = String(_state.guestsFilter);
    renderRoomsList(body);
  };
  body.querySelectorAll("button[data-book-room]").forEach((b) => {
    b.onclick = () => navigateToBook(h, Number(b.dataset.bookRoom));
  });
  body.querySelectorAll("button[data-chat-room]").forEach((b) => {
    b.onclick = () => {
      const roomId = Number(b.dataset.chatRoom);
      const r = (h.rooms || []).find((x) => x.id === roomId);
      openChatWithHotel(h.id, {
        type: "room",
        id: roomId,
        name: r?.name_ru,
        photo: r?.photos?.[0],
        extra: r ? t("hotel.price_per_night", { price: r.price_kgs }) : undefined,
        hotel_slug: h.slug,
      });
    };
  });
  ensureEventSource(h.slug || h.id, () => renderRoomsList(body));
}

function navigateToBook(h, roomId) {
  const q = _state.query;
  const qs = new URLSearchParams();
  if (q.check_in) qs.set("check_in", q.check_in);
  if (q.check_out) qs.set("check_out", q.check_out);
  qs.set("guests", String(_state.guestsFilter));
  const tail = `/book/${roomId}?${qs.toString()}`;
  navigate(hotelHash(h, tail));
}

async function updateRangeDates(body, ci, co) {
  _state.query.check_in = ci;
  _state.query.check_out = co;
  body.innerHTML = `<p>${t("common.loading")}</p>`;
  try {
    _state.hotel = await api.hotelDetails(_state.hotel.id, _state.query);
    setLastHotel(_state.hotel);
  } catch (e) {
    body.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    return;
  }
  renderRoomsList(body);
}

function roomCardHtml(r, hasDates) {
  const unavail = hasDates && r.available_for_dates === false;
  const chatBtn = `<button class="chat-icon-btn" type="button" data-chat-room="${r.id}" aria-label="${escapeHtml(t("chat.write_about_room"))}" title="${escapeHtml(t("chat.write_about_room"))}">${CHAT_ICON_SVG}</button>`;
  return `
    <div class="room ${unavail ? "unavailable" : ""}">
      <div class="room-titlerow">
        <h3>${escapeHtml(r.name_ru)}</h3>
        ${chatBtn}
      </div>
      <div class="meta">${t("hotel.capacity", { n: r.capacity })}${r.beds != null ? ` · ${t("hotel.beds", { n: r.beds })}` : ""}${r.floor != null ? ` · ${t("hotel.floor", { n: r.floor })}` : ""}</div>
      <div class="price">${t("hotel.price_per_night", { price: r.price_kgs })}</div>
      ${hasDates && r.total_kgs_for_dates != null ? `<div class="meta">${t("hotel.total", { total: r.total_kgs_for_dates })}</div>` : ""}
      ${unavail
        ? `<button class="primary" disabled>${t("hotel.unavailable")}</button>`
        : `<button class="primary" data-book-room="${r.id}">${t("hotel.book")}</button>`}
    </div>
  `;
}
