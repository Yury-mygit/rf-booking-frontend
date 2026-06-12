// Rooms screen — список комнат + filters (даты/гости) + SSE-refresh при
// серверных push'ах. Кнопка «Забронировать» уводит на /book/<roomId>.

import { getLang, t, tn } from "../../../i18n.js";
import { navigate, getQuery } from "../../../router.js";
import { setTitle, showBack } from "../../../topbar.js";
import { hideBottomNav } from "../../../bottomnav.js";
import { fmtShort } from "../../../widgets/calendar_utils.js";
import { showToast } from "../../../widgets/toast.js";

import { _state, ensureHotel, ensureEventSource, escapeHtml, hotelHash } from "./_shared.js";
import { CHAT_ICON_SVG, openChatWithHotel } from "../chat/open.js";

export async function renderHotelRooms({ id }) {
  const app = document.getElementById("app");
  app.innerHTML = `<p>${t("common.loading")}</p>`;
  const q = getQuery();
  _state.query = q;
  _state.guestsFilter = Number(q.guests) || 1;
  _state.bedsFilter = q.beds === "single" || q.beds === "double" ? q.beds : null;
  let h;
  try {
    h = await ensureHotel(id, q);
  } catch (e) {
    app.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    return;
  }
  setTitle(t("client.nav.rooms"));
  showBack(() => navigate(hotelHash(h)));
  hideBottomNav();
  document.body.classList.add("has-rooms-controls");
  app.innerHTML = `<div id="rooms-section"></div>`;
  renderRoomsList(document.getElementById("rooms-section"));
}

function renderRoomsList(body) {
  const h = _state.hotel;
  const q = _state.query;
  const g = _state.guestsFilter;
  const beds = _state.bedsFilter;
  const hasDates = q.check_in && q.check_out;
  const selectValue = beds === "single" ? "single" : beds === "double" ? "double" : g >= 3 ? "family" : g === 1 ? "1" : "1";
  // Backend уже отфильтровал по beds/guests/датам (см. card #95).
  const rooms = h.rooms || [];
  const lang = getLang();
  const ciLabel = q.check_in ? fmtShort(q.check_in, lang) : t("rooms.check_in");
  const coLabel = q.check_out ? fmtShort(q.check_out, lang) : t("rooms.check_out");
  body.innerHTML = `
    <div id="rooms-list">
      ${rooms.length === 0
        ? `<p class="muted">${t("rooms.empty_filter")}</p>`
        : rooms.map((r) => roomCardHtml(r, hasDates)).join("")}
    </div>
    <div class="rooms-controls">
      <div class="filters-row">
        <div class="filter-cell filter-cell--dates">
          <button type="button" class="dates-field ${q.check_in ? "filled" : ""}" id="f-checkin-btn">
            <span class="dates-field-value">${escapeHtml(ciLabel)}</span>
            ${q.check_in ? `<span class="dates-field-clear" id="f-checkin-clear" role="button" aria-label="${escapeHtml(t("app.clear"))}">×</span>` : ""}
          </button>
          <button type="button" class="dates-field ${q.check_out ? "filled" : ""}" id="f-checkout-btn">
            <span class="dates-field-value">${escapeHtml(coLabel)}</span>
            ${q.check_out ? `<span class="dates-field-clear" id="f-checkout-clear" role="button" aria-label="${escapeHtml(t("app.clear"))}">×</span>` : ""}
          </button>
        </div>
        <div class="filter-cell filter-cell--guests">
          <select id="f-guests" aria-label="${escapeHtml(t("rooms.filter.guests"))}">
            <option value="1" ${selectValue === "1" ? "selected" : ""}>${escapeHtml(t("rooms.filter.guests_1"))}</option>
            <option value="single" ${selectValue === "single" ? "selected" : ""}>${escapeHtml(t("rooms.filter.guests_1plus1"))}</option>
            <option value="double" ${selectValue === "double" ? "selected" : ""}>${escapeHtml(t("rooms.filter.guests_2"))}</option>
            <option value="family" ${selectValue === "family" ? "selected" : ""}>${escapeHtml(t("rooms.filter.guests_family"))}</option>
          </select>
        </div>
      </div>
    </div>
  `;
  const openDates = (field, clearId) => (e) => {
    if (e.target.id === clearId) return;
    const qs = new URLSearchParams();
    qs.set("field", field);
    if (q.check_in) qs.set("check_in", q.check_in);
    if (q.check_out) qs.set("check_out", q.check_out);
    if (q.guests) qs.set("guests", q.guests);
    if (q.beds) qs.set("beds", q.beds);
    navigate(hotelHash(h, `/dates?${qs.toString()}`));
  };
  document.getElementById("f-checkin-btn").onclick = openDates("checkin", "f-checkin-clear");
  document.getElementById("f-checkout-btn").onclick = openDates("checkout", "f-checkout-clear");
  const clearField = (keepKey) => (e) => {
    e.stopPropagation();
    const qs = new URLSearchParams();
    if (q[keepKey]) qs.set(keepKey, q[keepKey]);
    if (q.guests) qs.set("guests", q.guests);
    if (q.beds) qs.set("beds", q.beds);
    const tail = qs.toString() ? `/rooms?${qs.toString()}` : "/rooms";
    navigate(hotelHash(h, tail));
  };
  const ciClear = document.getElementById("f-checkin-clear");
  if (ciClear) ciClear.onclick = clearField("check_out");
  const coClear = document.getElementById("f-checkout-clear");
  if (coClear) coClear.onclick = clearField("check_in");
  document.getElementById("f-guests").onchange = (e) => {
    const v = e.target.value;
    if (v === "single") {
      _state.guestsFilter = 2;
      _state.bedsFilter = "single";
    } else if (v === "double") {
      _state.guestsFilter = 2;
      _state.bedsFilter = "double";
    } else if (v === "family") {
      _state.guestsFilter = 4;
      _state.bedsFilter = null;
    } else {
      _state.guestsFilter = 1;
      _state.bedsFilter = null;
    }
    _state.query.guests = String(_state.guestsFilter);
    if (_state.bedsFilter) _state.query.beds = _state.bedsFilter;
    else delete _state.query.beds;
    renderRoomsList(body);
  };
  body.querySelectorAll("button[data-book-room]").forEach((b) => {
    b.onclick = () => {
      if (!hasDates) {
        showToast(t("rooms.dates_required"));
        return;
      }
      navigateToBook(h, Number(b.dataset.bookRoom));
    };
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
  const chatBtn = `<button class="chat-icon-btn" type="button" data-chat-room="${r.id}" aria-label="${escapeHtml(t("chat.write_about_room"))}" title="${escapeHtml(t("chat.write_about_room"))}">${CHAT_ICON_SVG}</button>`;
  const photo = (r.photos && r.photos[0]) || "";
  const photoStyle = photo ? ` style="background-image:url('${escapeHtml(photo)}')"` : "";
  const metaParts = [tn("hotel.guests", r.capacity)];
  if (r.single_beds > 0) metaParts.push(tn("hotel.single_beds", r.single_beds));
  if (r.double_beds > 0) metaParts.push(tn("hotel.double_beds", r.double_beds));
  if (r.floor != null) metaParts.push(t("hotel.floor", { n: r.floor }));
  return `
    <div class="room">
      <div class="room-photo"${photoStyle}></div>
      <div class="room-body">
        <div class="room-titlerow">
          <h3>${escapeHtml(r.name_ru)}</h3>
          ${chatBtn}
        </div>
        <div class="meta">${metaParts.join(" · ")}</div>
        <div class="price">${t("hotel.price_per_night", { price: r.price_kgs })}</div>
        ${hasDates && r.total_kgs_for_dates != null ? `<div class="meta">${t("hotel.total", { total: r.total_kgs_for_dates })}</div>` : ""}
        <button class="primary ${hasDates ? "" : "is-disabled"}" data-book-room="${r.id}">${t("hotel.book")}</button>
      </div>
    </div>
  `;
}
