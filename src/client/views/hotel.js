import { api } from "../../api.js";
import { getLang, t } from "../../i18n.js";
import { navigate, getQuery } from "../../router.js";
import { setTitle, showBack } from "../../topbar.js";
import { inTelegram, tg } from "../../tg.js";
import { mountDateRange } from "../../widgets/daterange.js";

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
  activeTab: "rooms",
  eventSource: null,
  refreshTimer: null,
};

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

function ensureEventSource(hotelSlugOrId) {
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
      const body = document.getElementById("tab-body");
      if (!body || _state.activeTab !== "rooms") return;
      try {
        _state.hotel = await api.hotelDetails(_state.hotel.id, _state.query);
        renderRooms(body);
      } catch {
        // network blip — EventSource will reconnect; ignore.
      }
    }, 300);
  };
}

// При навигации вне /client/hotel/X — закрываем SSE.
window.addEventListener("hashchange", () => {
  const hash = location.hash.replace(/^#/, "").split("?")[0];
  if (!hash.startsWith("/client/hotel/") || hash.endsWith("/map")) closeEventSource();
});

export async function renderHotel({ id }) {
  const app = document.getElementById("app");
  app.innerHTML = `<p>${t("common.loading")}</p>`;
  const q = getQuery();
  _state.query = q;
  _state.guestsFilter = Number(q.guests) || 1;
  try {
    _state.hotel = await api.hotelDetails(id, q);
  } catch (e) {
    app.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    return;
  }
  const h = _state.hotel;
  const photo = (h.photos && h.photos[0]) || "";
  const hotelName = h.name_ru;
  setTitle(t("hotel.title_with_name", { name: hotelName }));
  showBack(() => navigate("#/"));
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
    <div class="tabs">
      <button class="tab" data-tab="rooms">${t("tabs.rooms")}</button>
      <button class="tab" data-tab="my">${t("tabs.my")}</button>
      <button class="tab" data-tab="services">${t("tabs.services")}</button>
    </div>
    <div id="tab-body"></div>
  `;
  document.querySelectorAll(".tab").forEach((b) => {
    b.onclick = () => switchTab(b.dataset.tab);
  });
  const mapBtn = document.getElementById("hotel-map-btn");
  if (mapBtn) mapBtn.onclick = () => navigate(`#/client/hotel/${h.slug || h.id}/map`);
  switchTab(_state.activeTab);
}

function switchTab(name) {
  _state.activeTab = name;
  document.querySelectorAll(".tab").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === name),
  );
  const body = document.getElementById("tab-body");
  if (name === "rooms") return renderRooms(body);
  if (name === "my") return renderMyBookings(body);
  if (name === "services") return renderServices(body);
}

function renderRooms(body) {
  const h = _state.hotel;
  const q = _state.query;
  const g = _state.guestsFilter;
  const hasDates = q.check_in && q.check_out;
  const rooms = h.rooms.filter((r) => r.capacity >= g);
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
    <div id="book-result"></div>
    <div id="book-modal-mount"></div>
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
    renderRooms(body);
  };
  body.querySelectorAll("button[data-book-room]").forEach((b) => {
    b.onclick = () => openBookModal(Number(b.dataset.bookRoom));
  });
  ensureEventSource(_state.hotel.slug || _state.hotel.id);
}

async function updateRangeDates(body, ci, co) {
  _state.query.check_in = ci;
  _state.query.check_out = co;
  body.innerHTML = `<p>${t("common.loading")}</p>`;
  try {
    _state.hotel = await api.hotelDetails(_state.hotel.id, _state.query);
  } catch (e) {
    body.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    return;
  }
  renderRooms(body);
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

function openBookModal(roomId) {
  const r = _state.hotel.rooms.find((x) => x.id === roomId);
  if (!r) return;
  const q = _state.query;
  const mount = document.getElementById("book-modal-mount");
  const datesPicked = Boolean(q.check_in && q.check_out);
  const datesBlock = datesPicked
    ? `<div class="modal-summary">${t("rooms.modal_dates", { ci: q.check_in, co: q.check_out })}</div>`
    : `<div class="form-row"><div id="m-dates"></div></div>`;
  mount.innerHTML = `
    <div class="modal-bg">
      <div class="modal">
        <h2>${t("rooms.modal_title", { room: escapeHtml(r.name_ru) })}</h2>
        ${datesBlock}
        <div class="form-row">
          <label>${t("rooms.filter.guests")} (max ${r.capacity})</label>
          <input id="m-g" type="number" min="1" max="${r.capacity}" value="${Math.min(_state.guestsFilter, r.capacity)}" />
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="secondary" id="m-cancel">${t("common.cancel")}</button>
          <button class="primary" id="m-ok" style="margin:0;flex:1">${t("rooms.confirm")}</button>
        </div>
        <div id="m-err" class="error"></div>
      </div>
    </div>
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
  document.getElementById("m-cancel").onclick = () => (mount.innerHTML = "");
  document.getElementById("m-ok").onclick = () => submitBook(roomId, mount, datesPicked, modalRange);
}

async function submitBook(roomId, mount, datesFromFilter, modalRange) {
  const q = _state.query;
  let ci, co;
  if (datesFromFilter) {
    ci = q.check_in;
    co = q.check_out;
  } else if (modalRange) {
    const v = modalRange.getValue();
    ci = v.start;
    co = v.end;
  }
  const g = Number(document.getElementById("m-g").value) || 1;
  const err = document.getElementById("m-err");
  if (!ci || !co) {
    err.textContent = t("rooms.dates_required");
    return;
  }

  if (!inTelegram && !api.hasToken()) {
    const link = buildTelegramDeepLink(_state.hotel.slug, ci, co, g);
    mount.innerHTML = `
      <div class="modal-bg"><div class="modal" style="text-align:center">
        <p>${t("book.need_telegram")}</p>
        <a class="primary" style="text-decoration:none;display:inline-block;padding:10px 16px;background:var(--accent);color:var(--accent-text);border-radius:4px"
           href="${link}">${t("book.open_in_telegram")}</a>
      </div></div>`;
    return;
  }
  if (!api.hasToken() && inTelegram) {
    try {
      const r = await api.authTg(tg.initData);
      api.setSession(r.token, r.user);
    } catch (e) {
      err.textContent = t("common.error", { msg: e.message });
      return;
    }
  }

  err.textContent = t("common.loading");
  try {
    const b = await api.createBooking({
      room_id: Number(roomId),
      check_in: ci,
      check_out: co,
      guests: g,
    });
    mount.innerHTML = "";
    navigate(`#/client/pay/${b.code}`);
  } catch (e) {
    err.textContent = t("common.error", { msg: e.message });
  }
}

async function renderMyBookings(body) {
  const h = _state.hotel;
  if (!api.hasToken()) {
    body.innerHTML = `<p class="muted">${t("my.need_auth")}<a href="#/client/login">${t("my.dev_login")}</a></p>`;
    return;
  }
  body.innerHTML = `<p>${t("common.loading")}</p>`;
  try {
    const items = await api.myBookingsAtHotel(h.id);
    if (!items.length) {
      body.innerHTML = `<p class="muted">${t("my.empty_for_hotel")}</p>`;
      return;
    }
    body.innerHTML = items.map((b) => {
      const payBtn = b.status === "pending" && !b.postpay
        ? `<div style="margin-top:8px"><a class="primary" href="#/client/pay/${b.code}">${t("my.pay")}</a></div>`
        : "";
      let statusText;
      if (b.status === "pending") {
        statusText = b.confirmed ? t("my.status.pending_confirmed") : t("my.status.pending_unconfirmed");
      } else {
        statusText = t("my.status." + b.status);
      }
      return `
      <div class="card">
        <div class="meta">${t("my.code", { code: b.code })}</div>
        <div>${t("my.dates", { ci: b.check_in, co: b.check_out })} · ${t("my.guests", { n: b.guests })}</div>
        <div class="price">${t("my.total", { total: b.total_kgs })}</div>
        <div class="meta">${statusText}</div>
        ${payBtn}
      </div>`;
    }).join("");
  } catch (e) {
    body.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
  }
}

export async function renderHotelMap({ id }) {
  const app = document.getElementById("app");
  app.innerHTML = `<p>${t("common.loading")}</p>`;
  let h = _state.hotel && (String(_state.hotel.id) === id || _state.hotel.slug === id)
    ? _state.hotel
    : null;
  if (!h) {
    try {
      h = await api.hotelDetails(id, {});
      _state.hotel = h;
    } catch (e) {
      app.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
      return;
    }
  }
  const backHash = `#/client/hotel/${h.slug || h.id}`;
  setTitle(t("hotel.location_title"));
  showBack(() => {
    // Prefer history.back so query params (dates/guests) are preserved.
    if (history.length > 1) history.back();
    else navigate(backHash);
  });

  if (h.lat == null || h.lng == null) {
    app.innerHTML = `<p class="muted">${t("hotel.no_coords")}</p>`;
    return;
  }
  const lat = Number(h.lat);
  const lng = Number(h.lng);
  const d = 0.005; // ≈ 500m around the marker for default zoom
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

function renderServices(body) {
  const h = _state.hotel;
  if (!h.services || !h.services.length) {
    body.innerHTML = `<p class="muted">${t("services.empty")}</p>`;
    return;
  }
  body.innerHTML = h.services.map((s) => `
    <div class="card">
      <h3>${escapeHtml(s.name_ru)}</h3>
      <div class="price">${s.price_kgs != null ? t("hotel.price_per_night", { price: s.price_kgs }).replace("/ночь", "").replace("/night", "").replace("/түнгө", "") : t("services.free")}</div>
    </div>
  `).join("");
}
