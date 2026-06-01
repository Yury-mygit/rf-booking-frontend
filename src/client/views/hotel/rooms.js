// Rooms screen — список комнат + filters (даты/гости) + SSE-refresh при
// серверных push'ах. Кнопка «Забронировать» уводит на /book/<roomId>.

import { getLang, t, tn } from "../../../i18n.js";
import { navigate, getQuery } from "../../../router.js";
import { setTitle, showBack } from "../../../topbar.js";
import { setBottomNav } from "../../../bottomnav.js";
import { fmtDatesField } from "../../../widgets/calendar_utils.js";

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
  setBottomNav([]);
  app.innerHTML = `<div id="rooms-section"></div>`;
  renderRoomsList(document.getElementById("rooms-section"));
}

function renderRoomsList(body) {
  const h = _state.hotel;
  const q = _state.query;
  const g = _state.guestsFilter;
  const hasDates = q.check_in && q.check_out;
  const rooms = (h.rooms || []).filter((r) => r.capacity >= g);
  const datesLabel = fmtDatesField(q.check_in, q.check_out, getLang()) || t("rooms.dates");
  const hasDateValue = !!(q.check_in || q.check_out);
  body.innerHTML = `
    <div class="rooms-controls">
      <div class="filters-row">
        <div class="filter-cell filter-cell--dates">
          <button type="button" class="dates-field ${hasDateValue ? "filled" : ""}" id="f-dates-btn">
            <span class="dates-field-value">${escapeHtml(datesLabel)}</span>
            ${hasDateValue ? `<span class="dates-field-clear" id="f-dates-clear" role="button" aria-label="${escapeHtml(t("app.clear"))}">×</span>` : ""}
          </button>
        </div>
        <div class="filter-cell filter-cell--guests">
          <select id="f-guests" aria-label="${escapeHtml(t("rooms.filter.guests"))}">
            <option value="1" ${g <= 1 ? "selected" : ""}>${escapeHtml(t("rooms.filter.guests_1"))}</option>
            <option value="2" ${g === 2 ? "selected" : ""}>${escapeHtml(t("rooms.filter.guests_2"))}</option>
            <option value="4" ${g >= 3 ? "selected" : ""}>${escapeHtml(t("rooms.filter.guests_family"))}</option>
          </select>
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
  document.getElementById("f-dates-btn").onclick = (e) => {
    if (e.target.id === "f-dates-clear") return;
    const qs = new URLSearchParams();
    if (q.check_in) qs.set("check_in", q.check_in);
    if (q.check_out) qs.set("check_out", q.check_out);
    if (q.guests) qs.set("guests", q.guests);
    const tail = qs.toString() ? `/dates?${qs.toString()}` : "/dates";
    navigate(hotelHash(h, tail));
  };
  const clearBtn = document.getElementById("f-dates-clear");
  if (clearBtn) clearBtn.onclick = (e) => {
    e.stopPropagation();
    const qs = new URLSearchParams();
    if (q.guests) qs.set("guests", q.guests);
    const tail = qs.toString() ? `/rooms?${qs.toString()}` : "/rooms";
    navigate(hotelHash(h, tail));
  };
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

function roomCardHtml(r, hasDates) {
  const unavail = hasDates && r.available_for_dates === false;
  const chatBtn = `<button class="chat-icon-btn" type="button" data-chat-room="${r.id}" aria-label="${escapeHtml(t("chat.write_about_room"))}" title="${escapeHtml(t("chat.write_about_room"))}">${CHAT_ICON_SVG}</button>`;
  const photo = (r.photos && r.photos[0]) || "";
  const photoStyle = photo ? ` style="background-image:url('${escapeHtml(photo)}')"` : "";
  const metaParts = [tn("hotel.guests", r.capacity)];
  if (r.single_beds > 0) metaParts.push(tn("hotel.single_beds", r.single_beds));
  if (r.double_beds > 0) metaParts.push(tn("hotel.double_beds", r.double_beds));
  if (r.floor != null) metaParts.push(t("hotel.floor", { n: r.floor }));
  return `
    <div class="room ${unavail ? "unavailable" : ""}">
      <div class="room-photo"${photoStyle}></div>
      <div class="room-body">
        <div class="room-titlerow">
          <h3>${escapeHtml(r.name_ru)}</h3>
          ${chatBtn}
        </div>
        <div class="meta">${metaParts.join(" · ")}</div>
        <div class="price">${t("hotel.price_per_night", { price: r.price_kgs })}</div>
        ${hasDates && r.total_kgs_for_dates != null ? `<div class="meta">${t("hotel.total", { total: r.total_kgs_for_dates })}</div>` : ""}
        ${unavail
          ? `<button class="primary" disabled>${t("hotel.unavailable")}</button>`
          : `<button class="primary" data-book-room="${r.id}">${t("hotel.book")}</button>`}
      </div>
    </div>
  `;
}
