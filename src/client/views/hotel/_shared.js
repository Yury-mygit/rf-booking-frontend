// Shared state и helpers для 5 экранов отеля (detail/rooms/services/book/map).
//
// _state.hotel — кэш hotelDetails: переход detail → rooms → services не
// дёргает API повторно, если slug совпал и query пустое. /rooms и /book
// передают q (даты/гости), что вызывает re-fetch и обновляет _state.hotel.
//
// EventSource подписан на /public/hotels/{slug}/events; debounced 300ms
// refresh hotelDetails при push'е сервера. Закрывается при уходе с
// /client/hotel/<slug>/rooms (hashchange listener ниже).

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { setLastHotel } from "../../state.js";

export const _state = {
  hotel: null,
  query: {},
  guestsFilter: 1,
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
  setLastHotel(_state.hotel);
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

export function hotelHash(h, tail = "") {
  return `#/client/hotel/${encodeURIComponent(h.slug || h.id)}${tail}`;
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
