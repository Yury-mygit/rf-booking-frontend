// Клиентский список отелей (`#/client/hotels`). TBB-70: sticky
// filter-header с 4 chip'ами + expand-search + шторки. Layout карточек
// — 3-line (TBB-57).

import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { navigate, getQuery, currentPath } from "../../router.js";
import { setTitle, showBack } from "../../topbar.js";
import { setBottomNav } from "../../bottomnav.js";
import { clientNavItems } from "../nav.js";
import { PIN_SVG } from "./hotel/_shared.js";
import { preloadDestinations, openFilterDrawer } from "./hotels_filter.js";

const FILTER_KEYS_INT = ["destination_id", "adults", "children", "infants"];
const FILTER_KEYS_STR = ["check_in", "check_out", "q", "sort"];

let _state = null;
let _headerEl = null;
let _listEl = null;

export async function renderHotels() {
  setTitle(t("client.nav.hotels"));
  showBack(() => navigate("#/"));
  setBottomNav(clientNavItems("hotels"));

  const app = document.getElementById("app");
  _state = readState();
  app.innerHTML = `
    <div class="hotels-view">
      <div class="hotels-header" id="hotels-filter-header"></div>
      <div class="hotels-list" id="hotels-list"><p>${t("common.loading")}</p></div>
    </div>
  `;
  _headerEl = document.getElementById("hotels-filter-header");
  _listEl = document.getElementById("hotels-list");

  // Прогрев destinations (нужен и для chip-labels, и для drawer'а).
  try {
    await preloadDestinations();
  } catch (_) { /* header покажет плейсхолдер, drawer покажет ошибку */ }

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

function applyPatch(patch) {
  const next = { ..._state };
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === "") delete next[k];
    else next[k] = v;
  }
  _state = next;
  writeState(_state);
  renderHeader();
  fetchAndRender();
}

// ─── Header ───────────────────────────────────────────────────────────

function renderHeader() {
  const activeCount = Object.keys(_state).length;
  _headerEl.innerHTML = `
    <button type="button" class="hotels-filter-open" data-open-filters>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
      </svg>
      <span>${escape(t("hotels.filter.open"))}</span>
      ${activeCount ? `<span class="hfo-badge">${activeCount}</span>` : ""}
    </button>
  `;
  _headerEl
    .querySelector("[data-open-filters]")
    .addEventListener("click", () => openFilterDrawer(() => _state, applyPatch));
}

// ─── Fetch + list ─────────────────────────────────────────────────────

async function fetchAndRender() {
  _listEl.innerHTML = `<p>${t("common.loading")}</p>`;
  let items;
  try {
    items = await api.publicHotels(_state);
  } catch (e) {
    _listEl.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    return;
  }
  if (!items.length) {
    // При активных фильтрах — «ничего не найдено», иначе — «отелей пока нет».
    const anyFilter = Object.keys(_state).length > 0;
    const msg = anyFilter ? t("hotels.filter.no_results") : t("hotels.empty");
    _listEl.innerHTML = `<p class="muted">${escape(msg)}</p>`;
    return;
  }
  _listEl.innerHTML = items.map(hotelCardHtml).join("");
}

function hotelCardHtml(h) {
  const target = `#/client/hotel/${encodeURIComponent(h.slug || h.id)}`;
  const photo = (h.photos && h.photos[0]) || "";
  const photoStyle = photo ? `style="background-image:url('${escape(photo)}')"` : "";
  const addressText = [h.city, h.address].filter(Boolean).map(escape).join(" · ");
  const locLine = addressText
    ? `<p class="hcr-loc">${PIN_SVG}<span class="hcr-loc-text">${addressText}</span></p>`
    : "";
  const priceLine = h.min_price_kgs != null
    ? `<p class="hcr-price">${t("hotels.price_from", { amount: formatPriceKgs(h.min_price_kgs) })}</p>`
    : "";
  return `
    <a class="hotel-card-row" href="${target}">
      <div class="hcr-photo" ${photoStyle}></div>
      <div class="hcr-body">
        <h3>${escape(h.name_ru)}</h3>
        ${locLine}
        ${priceLine}
      </div>
    </a>`;
}

function formatPriceKgs(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function escape(s) {
  if (s == null) return "";
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
