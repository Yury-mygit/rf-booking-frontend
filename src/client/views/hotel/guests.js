// Guests picker — full-screen view с тремя counter'ами (adults /
// children / infants) и conditional age-inputs при children > 0.
// Открывается с client/hotel/<slug>/guests?<old query>. Локальный
// state, sticky-кнопка «Применить» → /rooms с новыми params; back
// (showBack) = cancel, query не меняется. child_ages кодируется в
// URL как csv ("6,9") — Object.fromEntries(URLSearchParams) теряет
// duplicate keys, multi-value через `&child_ages=` не работает.

import { t } from "../../../i18n.js";
import { navigate, getQuery } from "../../../router.js";
import { setTitle, showBack } from "../../../topbar.js";
import { setBottomNav } from "../../../bottomnav.js";

import {
  ensureHotel,
  escapeHtml,
  hotelHash,
  readGuestsFromQuery,
} from "./_shared.js";

const LIMITS = {
  adults: { min: 1, max: 8 },
  children: { min: 0, max: 6 },
  infants: { min: 0, max: 4 },
};

export async function renderHotelGuests({ id }) {
  const app = document.getElementById("app");
  app.innerHTML = `<p>${t("common.loading")}</p>`;
  let h;
  try {
    h = await ensureHotel(id);
  } catch (e) {
    app.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    return;
  }
  setTitle(t("rooms.guests.title"));
  setBottomNav([]);

  const q = getQuery();
  const state = readGuestsFromQuery(q);
  syncChildAges(state);

  function backToRooms(commit) {
    const qs = new URLSearchParams();
    if (q.check_in) qs.set("check_in", q.check_in);
    if (q.check_out) qs.set("check_out", q.check_out);
    if (q.beds) qs.set("beds", q.beds);
    if (commit) {
      qs.set("adults", String(state.adults));
      if (state.children > 0) qs.set("children", String(state.children));
      if (state.infants > 0) qs.set("infants", String(state.infants));
      if (state.children > 0 && state.child_ages.length > 0) {
        qs.set("child_ages", state.child_ages.join(","));
      }
    } else {
      if (q.adults) qs.set("adults", q.adults);
      if (q.children) qs.set("children", q.children);
      if (q.infants) qs.set("infants", q.infants);
      if (q.child_ages) qs.set("child_ages", q.child_ages);
    }
    navigate(hotelHash(h, "/rooms?" + qs.toString()));
  }

  showBack(() => backToRooms(false));

  function render() {
    const rowsHtml = ["adults", "children", "infants"]
      .map((key) => counterRowHtml(key, state[key]))
      .join("");
    const agesHtml = state.children > 0 ? ageInputsHtml(state.child_ages) : "";
    app.innerHTML = `
      <div class="guests-view">
        ${rowsHtml}
        ${agesHtml}
        <div class="guests-apply-bar">
          <button type="button" class="primary" id="guests-apply">${escapeHtml(t("rooms.guests.apply"))}</button>
        </div>
      </div>
    `;
    wireCounters();
    wireAges();
    document.getElementById("guests-apply").onclick = () => backToRooms(true);
  }

  function counterRowHtml(key, value) {
    const { min, max } = LIMITS[key];
    return `
      <div class="guests-row" data-row="${key}">
        <div class="guests-row-info">
          <div class="guests-row-title">${escapeHtml(t(`rooms.guests.${key}.title`))}</div>
          <div class="guests-row-hint">${escapeHtml(t(`rooms.guests.${key}.hint`))}</div>
        </div>
        <div class="guests-counter">
          <button type="button" class="guests-btn" data-act="dec" ${value <= min ? "disabled" : ""} aria-label="−">−</button>
          <input type="number" inputmode="numeric" min="${min}" max="${max}" value="${value}" class="guests-input" />
          <button type="button" class="guests-btn" data-act="inc" ${value >= max ? "disabled" : ""} aria-label="+">+</button>
        </div>
      </div>
    `;
  }

  function ageInputsHtml(ages) {
    const inputs = ages
      .map(
        (a, i) => `
      <div class="guests-age-cell">
        <label>${escapeHtml(t("rooms.guests.children.age_label", { i: i + 1 }))}</label>
        <input type="number" inputmode="numeric" min="0" max="17" value="${a}" class="guests-age-input" data-idx="${i}" />
      </div>
    `,
      )
      .join("");
    return `
      <div class="guests-ages">
        <div class="guests-row-title">${escapeHtml(t("rooms.guests.children.ages_title"))}</div>
        <div class="guests-ages-grid">${inputs}</div>
      </div>
    `;
  }

  function wireCounters() {
    app.querySelectorAll(".guests-row").forEach((row) => {
      const key = row.dataset.row;
      const inputEl = row.querySelector(".guests-input");
      row.querySelector('[data-act="dec"]').onclick = () => updateCounter(key, -1);
      row.querySelector('[data-act="inc"]').onclick = () => updateCounter(key, +1);
      inputEl.addEventListener("change", () => {
        const v = Number(inputEl.value);
        if (Number.isFinite(v)) updateCounter(key, v - state[key]);
      });
    });
  }

  function wireAges() {
    app.querySelectorAll(".guests-age-input").forEach((inputEl) => {
      const idx = Number(inputEl.dataset.idx);
      inputEl.addEventListener("change", () => {
        const v = Number(inputEl.value);
        state.child_ages[idx] = clamp(Number.isFinite(v) ? v : 0, 0, 17);
      });
    });
  }

  function updateCounter(key, delta) {
    const { min, max } = LIMITS[key];
    const next = clamp(state[key] + delta, min, max);
    if (next === state[key]) return;
    state[key] = next;
    if (key === "children") syncChildAges(state);
    render();
  }

  render();
}

function clamp(n, lo, hi) {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

function syncChildAges(state) {
  while (state.child_ages.length < state.children) state.child_ages.push(0);
  if (state.child_ages.length > state.children) {
    state.child_ages.length = state.children;
  }
}
