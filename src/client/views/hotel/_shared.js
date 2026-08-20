// Shared state и helpers для 5 экранов отеля (detail/rooms/services/book/map).
//
// _state.hotel — кэш hotelDetails: переход detail → rooms → services не
// дёргает API повторно, если slug совпал и query пустое. /rooms и /book
// передают q (даты/гости), что вызывает re-fetch и обновляет _state.hotel.
//
// EventSource подписан на /public/hotels/{slug}/events; debounced 300ms
// refresh hotelDetails при push'е сервера. Живёт пока пользователь в
// любом /client/hotel/<slug>/* view; закрывается при уходе (hashchange
// listener ниже).

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { HOTEL_AMENITIES_BY_SECTION } from "../../../widgets/amenities_spec.js";
import { amenityIconHtml } from "../../../widgets/amenities_icons.js";

export const _state = {
  hotel: null,
  query: {},
  guests: { adults: 1, children: 0, infants: 0, child_ages: [] },
  bedsFilter: null,
  eventSource: null,
  refreshTimer: null,
};

export function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

export function matchesCached(slugOrId) {
  if (!_state.hotel) return false;
  return _state.hotel.slug === slugOrId || String(_state.hotel.id) === String(slugOrId);
}

// Загружает отель с учётом query (даты/гости). Кэширует в `_state.hotel`.
// Передавай `q` для /rooms и /book (нужны даты для available_for_dates),
// и `{}` для /hotel и /services (там даты не важны).
export async function ensureHotel(slugOrId, q = {}) {
  if (matchesCached(slugOrId) && Object.keys(q).length === 0) {
    return _state.hotel;
  }
  _state.hotel = await api.hotelDetails(slugOrId, q);
  return _state.hotel;
}

export function closeEventSource() {
  if (_state.eventSource) {
    _state.eventSource.close();
    _state.eventSource = null;
  }
  if (_state.refreshTimer) {
    clearTimeout(_state.refreshTimer);
    _state.refreshTimer = null;
  }
}

export function ensureEventSource(hotelSlugOrId, onRefresh) {
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
        onRefresh();
      } catch {
        // network blip — EventSource will reconnect; ignore.
      }
    }, 300);
  };
}

// SSE закрываем при уходе из hotel-семейства views (/client/hotel/<slug>/*).
// body-классы фиксированных нижних панелей снимаем сразу же, чтобы
// padding-bottom не висел на других view.
window.addEventListener("hashchange", () => {
  const hash = location.hash.replace(/^#/, "").split("?")[0];
  if (!/^\/client\/hotel\/[^/]+(\/.*)?$/.test(hash)) {
    closeEventSource();
  }
  if (!/^\/client\/hotel\/[^/]+\/rooms$/.test(hash)) {
    document.body.classList.remove("has-rooms-controls");
  }
  if (!/^\/client\/hotel\/[^/]+\/book\/\d+$/.test(hash)) {
    document.body.classList.remove("has-book-confirm-bar");
  }
});

export function hotelHash(h, tail = "") {
  return `#/client/hotel/${encodeURIComponent(h.slug || h.id)}${tail}`;
}

// Structural guests helpers (card #125).
// `_state.guests = {adults, children, infants, child_ages}` — readGuests
// клампит ввод по карте (Q4), parseChildAges разбирает csv (Q9 кодировка).
const GUESTS_LIMITS = {
  adults: { min: 1, max: 8 },
  children: { min: 0, max: 6 },
  infants: { min: 0, max: 4 },
};

export function readGuestsFromQuery(q) {
  const clamp = (n, lo, hi) => (n < lo ? lo : n > hi ? hi : n);
  return {
    adults: clamp(Number(q.adults) || 1, GUESTS_LIMITS.adults.min, GUESTS_LIMITS.adults.max),
    children: clamp(Number(q.children) || 0, GUESTS_LIMITS.children.min, GUESTS_LIMITS.children.max),
    infants: clamp(Number(q.infants) || 0, GUESTS_LIMITS.infants.min, GUESTS_LIMITS.infants.max),
    child_ages: (q.child_ages || "")
      .split(",")
      .map(Number)
      .filter((n) => Number.isFinite(n) && n >= 0),
  };
}

export function preserveGuestsQuery(qs, q) {
  if (q.adults) qs.set("adults", q.adults);
  if (q.children) qs.set("children", q.children);
  if (q.infants) qs.set("infants", q.infants);
  if (q.child_ages) qs.set("child_ages", q.child_ages);
}

export function setGuestsQuery(qs, guests) {
  qs.set("adults", String(guests.adults));
  if (guests.children > 0) qs.set("children", String(guests.children));
  if (guests.infants > 0) qs.set("infants", String(guests.infants));
  if (guests.children > 0 && guests.child_ages.length > 0) {
    qs.set("child_ages", guests.child_ages.join(","));
  }
}

// Label for `.guests-field` button + summary в book.js.
// Всегда показываем adults (для default '1 взр.' вместо 'Гости' — TBB-27);
// children/infants — условно, если >0. Infants picker row скрыт с 2026-06-23,
// но infants могут прийти через legacy-query / back-нав от book.js.
export function formatGuestsLabel({ adults, children, infants }) {
  const parts = [t("rooms.guests.adults_short", { n: adults })];
  if (children > 0) parts.push(t("rooms.guests.children_short", { n: children }));
  if (infants > 0) parts.push(t("rooms.guests.infants_short", { n: infants }));
  return parts.join(" · ");
}

export const PIN_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>`;

// Список «акцентов» отеля — пока только meals (breakfast/full_board).
// Расширяется добавлением новых веток (wifi, parking, …).
// Возвращает HTML-строку готовых чипов в .hotel-accents, пусто если ничего.
export function hotelAccentsHtml(h) {
  const chips = [];
  if (h.meals && h.meals !== "none") {
    chips.push(`<span class="chip chip--accent">${escapeHtml(t(`hotel.meals_${h.meals}`))}</span>`);
  }
  return chips.length ? `<div class="hotel-accents">${chips.join("")}</div>` : "";
}

// Hotel-level amenities: чипсы с иконками, сгруппированные по секциям
// (general/dining). Пустые секции пропускаются; если ни одна секция
// не заполнена — возвращает "" (detail.js не рисует пустой блок).
export function hotelAmenitiesChipsHtml(h) {
  const picked = new Set(h.amenities || []);
  const sections = HOTEL_AMENITIES_BY_SECTION
    .map((sec) => ({ key: sec.section, kinds: sec.kinds.filter((k) => picked.has(k)) }))
    .filter((sec) => sec.kinds.length > 0);
  if (!sections.length) return "";
  return sections.map((sec) => `
    <div class="amenities-block">
      <div class="amenities-section-title">${escapeHtml(t("amenity.section." + sec.key))}</div>
      <div class="amenities-chips">
        ${sec.kinds.map((k) => {
          const label = escapeHtml(t("amenity." + k));
          return `<span class="chip-icon" data-kind="${k}" title="${label}" aria-label="${label}">${amenityIconHtml(k)}<span class="chip-label">${label}</span></span>`;
        }).join("")}
      </div>
    </div>
  `).join("");
}

// Chip → tap показывает tooltip с полным лейблом (иконка без подписи —
// не понятно что означает). Работает для всех `.chip-icon[data-kind]`
// внутри root'а. Используется detail.js и book.js.
let _tipEl = null;
function ensureTip() {
  if (_tipEl) return _tipEl;
  _tipEl = document.createElement("div");
  _tipEl.className = "chip-tooltip";
  document.body.appendChild(_tipEl);
  return _tipEl;
}
function showChipTip(chipEl, text) {
  const tip = ensureTip();
  tip.textContent = text;
  tip.classList.remove("below");
  tip.classList.add("show");
  requestAnimationFrame(() => {
    const chipRect = chipEl.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const margin = 8;
    let left = chipRect.left + chipRect.width / 2 - tipRect.width / 2;
    if (left < margin) left = margin;
    if (left + tipRect.width > window.innerWidth - margin) {
      left = window.innerWidth - tipRect.width - margin;
    }
    let top = chipRect.top - tipRect.height - 8;
    if (top < margin) {
      top = chipRect.bottom + 8;
      tip.classList.add("below");
    }
    tip.style.left = left + "px";
    tip.style.top = top + window.scrollY + "px";
  });
  if (tip._timer) clearTimeout(tip._timer);
  tip._timer = setTimeout(() => tip.classList.remove("show"), 1800);
}
export function bindChipTooltips(root) {
  root.querySelectorAll(".chip-icon[data-kind]").forEach((el) => {
    el.addEventListener("click", () => {
      const label = el.getAttribute("aria-label") || el.getAttribute("title") || "";
      if (label) showChipTip(el, label);
    });
  });
}

// Блок «Условия размещения»: время заезда / выезда, заполняются партнёром
// в подформе «Объект / Удобства / Размещение» (partner backend backfill'ит
// 14:00 / 12:00 при первом просмотре). Silent если оба поля пустые.
function fmtTime(v) {
  if (!v) return "";
  return v.slice(0, 5); // "HH:MM:SS" → "HH:MM"
}
export function hotelCheckinCheckoutHtml(h) {
  const ci = fmtTime(h.checkin_time);
  const co = fmtTime(h.checkout_time);
  if (!ci && !co) return "";
  const parts = [];
  if (ci) parts.push(`<div><span class="muted">${escapeHtml(t("amenity.section.checkin_label"))}</span> ${escapeHtml(t("amenity.checkin_from", { time: ci }))}</div>`);
  if (co) parts.push(`<div><span class="muted">${escapeHtml(t("amenity.section.checkout_label"))}</span> ${escapeHtml(t("amenity.checkout_until", { time: co }))}</div>`);
  return `<div class="amenities-times">
    <div class="amenities-section-title">${escapeHtml(t("amenity.section.checkin_checkout"))}</div>
    ${parts.join("")}
  </div>`;
}

// Блок «Правила бронирования» (TBB-62): min_stay + booking_mode +
// cancel_policy. Показывается всегда — клиент видит договор до брони,
// даже если правила = default (короткий срок, мгновенно, без штрафа).
export function hotelRulesHtml(h) {
  const minStay = h.min_stay_nights ?? 1;
  const mode = h.booking_mode ?? "instant";
  const policy = h.cancel_policy ?? "free";

  const minStayLine = escapeHtml(t("hotel.rules.min_stay", { n: minStay }));
  const modeLine = escapeHtml(t("hotel.rules.booking_mode." + mode));
  let cancelLine;
  if (policy === "free") {
    cancelLine = escapeHtml(t("hotel.rules.cancel.free"));
  } else {
    const days = h.cancel_days_threshold ?? 0;
    const pct = h.cancel_penalty_pct ?? 0;
    cancelLine = escapeHtml(t("hotel.rules.cancel.hold", { days, pct }));
  }
  return `<div class="amenities-times amenities-times--wide">
    <div class="amenities-section-title">${escapeHtml(t("hotel.rules.title"))}</div>
    <div><span class="muted">${escapeHtml(t("hotel.rules.min_stay_label"))}</span> ${minStayLine}</div>
    <div><span class="muted">${escapeHtml(t("hotel.rules.booking_mode_label"))}</span> ${modeLine}</div>
    <div><span class="muted">${escapeHtml(t("hotel.rules.cancel_label"))}</span> ${cancelLine}</div>
  </div>`;
}

// Блок «Местоположение»: заголовок + адрес + OSM iframe + кнопка «Открыть в 2GIS».
// Silent на пустоте (нет lat/lng — блок не рендерится, адрес и так виден в шапке).
export function hotelLocationHtml(h) {
  if (h.lat == null || h.lng == null) return "";
  const lat = Number(h.lat);
  const lng = Number(h.lng);
  const d = 0.005;
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  const osmSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  const dgisHref = `https://2gis.kg/?m=${lng}%2C${lat}%2F17&pt=${lng},${lat}`;
  const addressLine = [h.city, h.address].filter(Boolean).map(escapeHtml).join(" · ");
  return `
    <div class="hotel-location-block">
      <div class="amenities-section-title">${escapeHtml(t("hotel.location_title"))}</div>
      ${addressLine ? `<div class="meta map-address">${addressLine}</div>` : ""}
      <iframe class="map-frame" src="${osmSrc}" loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"></iframe>
      <div class="map-actions">
        <a class="primary" href="${dgisHref}" target="_blank" rel="noopener">
          ${escapeHtml(t("hotel.open_in_2gis"))}
        </a>
      </div>
    </div>
  `;
}
