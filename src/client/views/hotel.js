// Per-hotel вью клиента: Отель / Комнаты / Услуги / Забронировать / Карта.
// Все 5 экранов работают с одним и тем же `_state.hotel` (кэш hotelDetails).
// Bottom-nav рендерим в каждом экране (через clientNavItems с правильным active).

import { api } from "../../api.js";
import { getLang, t } from "../../i18n.js";
import { navigate, getQuery } from "../../router.js";
import { setTitle, showBack } from "../../topbar.js";
import { setBottomNav } from "../../bottomnav.js";
import { inTelegram, tg } from "../../tg.js";
import { mountDateRange } from "../../widgets/daterange.js";
import { clientNavItems } from "../nav.js";
import { setLastHotel } from "../state.js";

const PIN_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>`;

const CLIENT_BOT = "rforge_stay_bot";

function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function buildTelegramDeepLink(hotelSlug, ci, co, g) {
  const base = `hotel_${hotelSlug}`;
  const sp = ci && co ? `${base}_${ci}_${co}_${g || 1}` : base;
  return `https://t.me/${CLIENT_BOT}?startapp=${sp}`;
}

const _state = {
  hotel: null,
  query: {},
  guestsFilter: 1,
  eventSource: null,
  refreshTimer: null,
};

function matchesCached(slugOrId) {
  if (!_state.hotel) return false;
  return _state.hotel.slug === slugOrId || String(_state.hotel.id) === String(slugOrId);
}

// Загружает отель с учётом query (даты/гости). Кэширует в `_state.hotel`.
// Передавай `q` для /rooms и /book (нужны даты для available_for_dates),
// и `{}` для /hotel и /services (там даты не важны).
async function ensureHotel(slugOrId, q = {}) {
  if (matchesCached(slugOrId) && Object.keys(q).length === 0) {
    return _state.hotel;
  }
  _state.hotel = await api.hotelDetails(slugOrId, q);
  setLastHotel(_state.hotel);
  return _state.hotel;
}

function closeEventSource() {
  if (_state.eventSource) {
    _state.eventSource.close();
    _state.eventSource = null;
  }
  if (_state.refreshTimer) {
    clearTimeout(_state.refreshTimer);
    _state.refreshTimer = null;
  }
}

function ensureEventSource(hotelSlugOrId, onRefresh) {
  if (_state.eventSource && _state.eventSource.url.endsWith(`/${hotelSlugOrId}/events`)) {
    return;
  }
  closeEventSource();
  const url = `/api/v1/public/hotels/${encodeURIComponent(hotelSlugOrId)}/events`;
  const es = new EventSource(url);
  _state.eventSource = es;
  es.onmessage = () => {
    if (_state.refreshTimer) clearTimeout(_state.refreshTimer);
    _state.refreshTimer = setTimeout(async () => {
      _state.refreshTimer = null;
      try {
        _state.hotel = await api.hotelDetails(_state.hotel.id, _state.query);
        setLastHotel(_state.hotel);
        onRefresh();
      } catch {
        // network blip — EventSource will reconnect; ignore.
      }
    }, 300);
  };
}

// SSE закрываем при уходе с любого /client/hotel/<slug>/rooms.
window.addEventListener("hashchange", () => {
  const hash = location.hash.replace(/^#/, "").split("?")[0];
  if (!/^\/client\/hotel\/[^/]+\/rooms$/.test(hash)) closeEventSource();
});

function hotelHash(h, tail = "") {
  return `#/client/hotel/${encodeURIComponent(h.slug || h.id)}${tail}`;
}

// ─── Отель (фото + название + описание) ──────────────────────────────────
export async function renderHotelDetail({ id }) {
  const app = document.getElementById("app");
  app.innerHTML = `<p>${t("common.loading")}</p>`;
  let h;
  try {
    h = await ensureHotel(id);
  } catch (e) {
    app.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    return;
  }
  setTitle(h.name_ru);
  showBack(() => navigate("#/"));
  setBottomNav(clientNavItems("hotel"));
  const photo = (h.photos && h.photos[0]) || "";
  const addressText = [h.city, h.address].filter(Boolean).map(escapeHtml).join(" · ");
  const hasCoords = h.lat != null && h.lng != null;
  const pinBtn = hasCoords
    ? `<button class="map-pin-btn" id="hotel-map-btn" type="button" aria-label="${t("hotel.location_title")}" title="${t("hotel.location_title")}">${PIN_SVG}</button>`
    : "";
  app.innerHTML = `
    <div class="hotel-head-card">
      ${photo ? `<div class="hotel-head-photo" style="background-image:url('${escapeHtml(photo)}')"></div>` : ""}
      <div class="hotel-head-body">
        <h1>${escapeHtml(h.name_ru)}</h1>
        <div class="meta address-line">${addressText}${pinBtn}</div>
        ${h.description_ru ? `<p>${escapeHtml(h.description_ru)}</p>` : ""}
      </div>
    </div>
  `;
  const mapBtn = document.getElementById("hotel-map-btn");
  if (mapBtn) mapBtn.onclick = () => navigate(hotelHash(h, "/map"));
}

// ─── Комнаты отеля ───────────────────────────────────────────────────────
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
  setBottomNav(clientNavItems("rooms"));
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
  return `
    <div class="room ${unavail ? "unavailable" : ""}">
      <h3>${escapeHtml(r.name_ru)}</h3>
      <div class="meta">${t("hotel.capacity", { n: r.capacity })}${r.beds != null ? ` · ${t("hotel.beds", { n: r.beds })}` : ""}${r.floor != null ? ` · ${t("hotel.floor", { n: r.floor })}` : ""}</div>
      <div class="price">${t("hotel.price_per_night", { price: r.price_kgs })}</div>
      ${hasDates && r.total_kgs_for_dates != null ? `<div class="meta">${t("hotel.total", { total: r.total_kgs_for_dates })}</div>` : ""}
      ${unavail
        ? `<button class="primary" disabled>${t("hotel.unavailable")}</button>`
        : `<button class="primary" data-book-room="${r.id}">${t("hotel.book")}</button>`}
    </div>
  `;
}

// ─── Услуги отеля ────────────────────────────────────────────────────────
export async function renderHotelServices({ id }) {
  const app = document.getElementById("app");
  app.innerHTML = `<p>${t("common.loading")}</p>`;
  let h;
  try {
    h = await ensureHotel(id);
  } catch (e) {
    app.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    return;
  }
  setTitle(t("client.nav.services"));
  showBack(() => navigate(hotelHash(h)));
  setBottomNav(clientNavItems("services"));
  if (!h.services || !h.services.length) {
    app.innerHTML = `<p class="muted">${t("services.empty")}</p>`;
    return;
  }
  app.innerHTML = h.services.map((s) => `
    <div class="card">
      <h3>${escapeHtml(s.name_ru)}</h3>
      <div class="price">${servicePriceText(s)}</div>
    </div>
  `).join("");
}

function servicePriceText(s) {
  if (s.price_kgs == null) return t("services.free");
  // hotel.price_per_night содержит /ночь — для услуги это не уместно.
  return t("hotel.price_per_night", { price: s.price_kgs })
    .replace("/ночь", "")
    .replace("/night", "")
    .replace("/түнгө", "");
}

// ─── Забронировать (форма подтверждения, замена openBookModal) ──────────
export async function renderHotelBookConfirm({ id, roomId }) {
  const app = document.getElementById("app");
  app.innerHTML = `<p>${t("common.loading")}</p>`;
  const q = getQuery();
  let h;
  try {
    h = await ensureHotel(id, q);
  } catch (e) {
    app.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    return;
  }
  setTitle(t("client.nav.book"));
  showBack(() => navigate(hotelHash(h, "/rooms")));
  setBottomNav(clientNavItems("book"));

  const r = (h.rooms || []).find((x) => x.id === Number(roomId));
  if (!r) {
    app.innerHTML = `<p class="error">${t("book.room_not_found")}</p>`;
    return;
  }
  const datesPicked = Boolean(q.check_in && q.check_out);
  const initialGuests = Math.min(Number(q.guests) || 1, r.capacity);
  app.innerHTML = `
    <div class="card">
      <h2>${escapeHtml(r.name_ru)}</h2>
      <div class="meta">${t("hotel.capacity", { n: r.capacity })}${r.beds != null ? ` · ${t("hotel.beds", { n: r.beds })}` : ""}</div>
      <div class="price">${t("hotel.price_per_night", { price: r.price_kgs })}</div>
    </div>
    <div class="form-row">
      ${datesPicked
        ? `<div class="modal-summary">${t("rooms.modal_dates", { ci: q.check_in, co: q.check_out })}</div>`
        : `<div id="m-dates"></div>`}
    </div>
    <div class="form-row">
      <label for="m-g">${t("rooms.filter.guests")} (max ${r.capacity})</label>
      <input id="m-g" type="number" min="1" max="${r.capacity}" value="${initialGuests}" />
    </div>
    <button class="primary full" id="m-ok">${t("rooms.confirm")}</button>
    <div id="m-err" class="error"></div>
  `;
  let modalRange = null;
  if (!datesPicked) {
    modalRange = mountDateRange(document.getElementById("m-dates"), {
      lang: getLang(),
      labelIn: t("rooms.check_in"),
      labelOut: t("rooms.check_out"),
      placeholderIn: t("rooms.pick_date"),
      placeholderOut: t("rooms.pick_date"),
    });
  }
  document.getElementById("m-ok").onclick = () =>
    submitBookConfirm(h, r, q, datesPicked, modalRange);
}

async function submitBookConfirm(h, r, q, datesFromQuery, modalRange) {
  const err = document.getElementById("m-err");
  let ci, co;
  if (datesFromQuery) {
    ci = q.check_in;
    co = q.check_out;
  } else if (modalRange) {
    const v = modalRange.getValue();
    ci = v.start;
    co = v.end;
  }
  const g = Number(document.getElementById("m-g").value) || 1;
  if (!ci || !co) {
    err.textContent = t("rooms.dates_required");
    return;
  }
  if (!inTelegram && !api.hasToken()) {
    const link = buildTelegramDeepLink(h.slug, ci, co, g);
    document.getElementById("app").innerHTML = `
      <div class="card" style="text-align:center">
        <p>${t("book.need_telegram")}</p>
        <a class="primary" style="text-decoration:none;display:inline-block;padding:10px 16px;background:var(--accent);color:var(--accent-text);border-radius:4px"
           href="${link}">${t("book.open_in_telegram")}</a>
      </div>`;
    return;
  }
  if (!api.hasToken() && inTelegram) {
    try {
      const auth = await api.authTg(tg.initData);
      api.setSession(auth.token, auth.user);
    } catch (e) {
      err.textContent = t("common.error", { msg: e.message });
      return;
    }
  }
  err.textContent = t("common.loading");
  try {
    const b = await api.createBooking({
      room_id: r.id,
      check_in: ci,
      check_out: co,
      guests: g,
    });
    navigate(`#/client/pay/${b.code}`);
  } catch (e) {
    err.textContent = t("common.error", { msg: e.message });
  }
}

// ─── Карта (как было) ────────────────────────────────────────────────────
export async function renderHotelMap({ id }) {
  const app = document.getElementById("app");
  app.innerHTML = `<p>${t("common.loading")}</p>`;
  let h = matchesCached(id) ? _state.hotel : null;
  if (!h) {
    try {
      h = await api.hotelDetails(id, {});
      _state.hotel = h;
      setLastHotel(h);
    } catch (e) {
      app.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
      return;
    }
  }
  setTitle(t("hotel.location_title"));
  showBack(() => {
    if (history.length > 1) history.back();
    else navigate(hotelHash(h));
  });

  if (h.lat == null || h.lng == null) {
    app.innerHTML = `<p class="muted">${t("hotel.no_coords")}</p>`;
    return;
  }
  const lat = Number(h.lat);
  const lng = Number(h.lng);
  const d = 0.005;
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  const osmSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  const dgisHref = `https://2gis.kg/?m=${lng}%2C${lat}%2F17&pt=${lng},${lat}`;
  const addressLine = [h.city, h.address].filter(Boolean).map(escapeHtml).join(" · ");
  app.innerHTML = `
    <div class="map-screen">
      ${addressLine ? `<div class="meta map-address">${addressLine}</div>` : ""}
      <iframe class="map-frame" src="${osmSrc}" loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"></iframe>
      <div class="map-actions">
        <a class="primary" href="${dgisHref}" target="_blank" rel="noopener">
          ${t("hotel.open_in_2gis")}
        </a>
      </div>
    </div>
  `;
}
