// Rooms screen — список комнат отеля + фильтр-шапка (Даты/Гости/Sort/
// Search) через drawer, паттерн из /hotels (TBB-70). SSE-refresh при
// серверных push'ах. Кнопка «Забронировать» уводит на /book/<roomId>.

import { api } from "../../../api.js";
import { t, tn } from "../../../i18n.js";
import { navigate, getQuery, currentPath } from "../../../router.js";
import { setTitle, showBack } from "../../../topbar.js";
import { hideBottomNav } from "../../../bottomnav.js";

import {
  _state,
  ensureEventSource,
  escapeHtml,
  hotelHash,
} from "./_shared.js";
import { CHAT_ICON_SVG, openChatWithHotel } from "../chat/open.js";
import { openFilterDrawer } from "../hotels_filter.js";

const FILTER_KEYS_INT = ["adults", "children", "infants"];
const FILTER_KEYS_STR = ["check_in", "check_out", "q", "sort", "beds"];

let _filterState = null;
let _headerEl = null;
let _listEl = null;
let _hotelId = null;

export async function renderHotelRooms({ id }) {
  const app = document.getElementById("app");
  app.innerHTML = `<p>${t("common.loading")}</p>`;

  const q = getQuery();
  // Back-compat: старые ссылки `?guests=single|double|family|N` → structural.
  if (q.guests && !q.adults) {
    const mapped = mapLegacyGuests(q.guests);
    const qs = new URLSearchParams();
    if (q.check_in) qs.set("check_in", q.check_in);
    if (q.check_out) qs.set("check_out", q.check_out);
    if (mapped.beds) qs.set("beds", mapped.beds);
    else if (q.beds) qs.set("beds", q.beds);
    qs.set("adults", String(mapped.adults));
    if (mapped.children > 0) qs.set("children", String(mapped.children));
    navigate(`/client/hotel/${encodeURIComponent(id)}/rooms?${qs.toString()}`);
    return;
  }

  _hotelId = id;
  _filterState = readState();
  syncSharedState();

  setTitle(t("client.nav.rooms"));
  showBack(() => navigate(hotelHash({ slug: id, id })));
  hideBottomNav();
  document.body.classList.add("has-hotel-actions");

  app.innerHTML = `
    <div class="hotels-view">
      <div class="hotels-header" id="rooms-filter-header"></div>
      <div class="hotels-list" id="rooms-list"><p>${t("common.loading")}</p></div>
    </div>
    <div class="hotel-quick-actions"></div>
  `;
  _headerEl = document.getElementById("rooms-filter-header");
  _listEl = document.getElementById("rooms-list");
  renderHeader();
  await fetchAndRender();
}

// ─── State ────────────────────────────────────────────────────────────

function readState() {
  const q = getQuery();
  const s = {};
  for (const k of FILTER_KEYS_INT) {
    const v = q[k];
    if (v !== undefined && v !== "") {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) s[k] = n;
    }
  }
  for (const k of FILTER_KEYS_STR) {
    if (q[k]) s[k] = String(q[k]);
  }
  return s;
}

function writeState(state) {
  const qs = new URLSearchParams();
  for (const k of [...FILTER_KEYS_INT, ...FILTER_KEYS_STR]) {
    const v = state[k];
    if (v == null || v === "") continue;
    qs.set(k, String(v));
  }
  const path = currentPath();
  const hash = "#" + path + (qs.toString() ? "?" + qs : "");
  history.replaceState(null, "", hash);
}

// SSE refresh и navigateToBook читают из _shared._state — держим синк.
function syncSharedState() {
  _state.query = { ..._filterState };
  _state.guests = {
    adults: _filterState.adults || 1,
    children: _filterState.children || 0,
    infants: _filterState.infants || 0,
    child_ages: [],
  };
  _state.bedsFilter = _filterState.beds === "single" || _filterState.beds === "double" ? _filterState.beds : null;
}

function applyPatch(patch) {
  const next = { ..._filterState };
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === "") delete next[k];
    else next[k] = v;
  }
  _filterState = next;
  writeState(_filterState);
  syncSharedState();
  renderHeader();
  fetchAndRender();
}

// ─── Header ───────────────────────────────────────────────────────────

function renderHeader() {
  const activeCount = Object.keys(_filterState).filter((k) => k !== "beds").length;
  _headerEl.innerHTML = `
    <button type="button" class="hotels-filter-open" data-open-filters>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
      </svg>
      <span>${escapeHtml(t("hotels.filter.open"))}</span>
      ${activeCount ? `<span class="hfo-badge">${activeCount}</span>` : ""}
    </button>
  `;
  _headerEl
    .querySelector("[data-open-filters]")
    .addEventListener("click", () =>
      openFilterDrawer(() => _filterState, applyPatch, {
        showDestination: false,
        searchPlaceholderKey: "rooms.filter.search_placeholder",
      }),
    );
}

// ─── Fetch + list ─────────────────────────────────────────────────────

async function fetchAndRender() {
  _listEl.innerHTML = `<p>${t("common.loading")}</p>`;
  let hotel;
  try {
    hotel = await api.hotelDetails(_hotelId, _filterState);
  } catch (e) {
    _listEl.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    return;
  }
  _state.hotel = hotel;
  const rooms = hotel.rooms || [];
  const hasDates = _filterState.check_in && _filterState.check_out;
  if (rooms.length === 0) {
    const anyFilter = Object.keys(_filterState).length > 0;
    _listEl.innerHTML = `<p class="muted">${anyFilter ? t("rooms.empty_filter") : t("rooms.empty")}</p>`;
  } else {
    _listEl.innerHTML = rooms.map((r) => roomCardHtml(r, hasDates)).join("");
    wireRoomCards(hotel);
  }
  ensureEventSource(hotel.slug || hotel.id, () => fetchAndRender());
}

function wireRoomCards(hotel) {
  _listEl.querySelectorAll("button[data-book-room]").forEach((b) => {
    b.onclick = () => navigateToBook(hotel, Number(b.dataset.bookRoom));
  });
  _listEl.querySelectorAll("button[data-need-dates]").forEach((b) => {
    b.onclick = () =>
      openFilterDrawer(() => _filterState, applyPatch, {
        showDestination: false,
        searchPlaceholderKey: "rooms.filter.search_placeholder",
      });
  });
  _listEl.querySelectorAll("button[data-chat-room]").forEach((b) => {
    b.onclick = () => {
      const roomId = Number(b.dataset.chatRoom);
      const r = (hotel.rooms || []).find((x) => x.id === roomId);
      openChatWithHotel(hotel.id, {
        type: "room",
        id: roomId,
        name: r?.name_ru,
        photo: r?.photos?.[0],
        extra: r ? t("hotel.price_per_night", { price: r.price_kgs }) : undefined,
        hotel_slug: hotel.slug,
      });
    };
  });
}

function navigateToBook(h, roomId) {
  const qs = new URLSearchParams();
  if (_filterState.check_in) qs.set("check_in", _filterState.check_in);
  if (_filterState.check_out) qs.set("check_out", _filterState.check_out);
  if (_filterState.adults) qs.set("adults", String(_filterState.adults));
  if (_filterState.children) qs.set("children", String(_filterState.children));
  if (_filterState.infants) qs.set("infants", String(_filterState.infants));
  if (_filterState.beds) qs.set("beds", _filterState.beds);
  const tail = `/book/${roomId}?${qs.toString()}`;
  navigate(hotelHash(h, tail));
}

function roomCardHtml(r, hasDates) {
  const chatBtn = `<button class="chat-icon-btn" type="button" data-chat-room="${r.id}" aria-label="${escapeHtml(t("chat.write_about_room"))}" title="${escapeHtml(t("chat.write_about_room"))}">${CHAT_ICON_SVG}</button>`;
  const photo = (r.photos && r.photos[0]) || "";
  const photoImg = photo
    ? `<img class="room-photo" src="${escapeHtml(photo)}/thumb" loading="lazy" decoding="async" alt="">`
    : `<div class="room-photo"></div>`;
  const metaParts = [tn("hotel.guests", r.capacity)];
  if (r.single_beds > 0) metaParts.push(tn("hotel.single_beds", r.single_beds));
  if (r.double_beds > 0) metaParts.push(tn("hotel.double_beds", r.double_beds));
  if (r.floor != null) metaParts.push(t("hotel.floor", { n: r.floor }));
  const cta = hasDates
    ? `<button class="primary" data-book-room="${r.id}">${t("hotel.book")}</button>`
    : `<button class="secondary" data-need-dates="1">${t("hotel.enter_dates")}</button>`;
  return `
    <div class="room">
      ${photoImg}
      <div class="room-body">
        <div class="room-titlerow">
          <h3>${escapeHtml(r.name_ru)}</h3>
          ${chatBtn}
        </div>
        <div class="meta">${metaParts.join(" · ")}</div>
        <div class="price">${t("hotel.price_per_night", { price: r.price_kgs })}</div>
        ${hasDates && r.total_kgs_for_dates != null ? `<div class="meta">${t("hotel.total", { total: r.total_kgs_for_dates })}</div>` : ""}
        ${cta}
      </div>
    </div>
  `;
}

function mapLegacyGuests(g) {
  if (g === "family") return { adults: 2, children: 2, beds: null };
  if (g === "double") return { adults: 2, children: 0, beds: "double" };
  if (g === "single") return { adults: 2, children: 0, beds: "single" };
  const n = Number(g);
  if (Number.isFinite(n) && n >= 1) {
    return { adults: Math.min(Math.max(Math.trunc(n), 1), 8), children: 0, beds: null };
  }
  return { adults: 1, children: 0, beds: null };
}
