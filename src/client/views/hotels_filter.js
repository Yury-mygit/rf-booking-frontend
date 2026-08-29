// Sticky header + drawers для клиентского списка отелей (TBB-70).
//
// Один экспорт `renderHotelsHeader(container, state, onChange)`:
// - container: DOM-узел, куда монтируется 2-рядная шапка.
// - state: { destination_id?, check_in?, check_out?, adults, children, infants, q }.
// - onChange(next): callback после apply в любом чипе / поиске.
//
// Шапка чисто presentational — не читает URL, не фетчит список. Всё
// снаружи (в `hotels.js`).

import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { escapeHtml } from "./hotel/_shared.js";
import { openTopDrawer } from "../../widgets/top_drawer.js";
import {
  addMonths,
  buildMonthGrid,
  fmtMonthTitle,
  fromISO,
  startOfMonth,
  todayISO,
  toISO,
  weekdayShortNames,
} from "../../widgets/calendar_utils.js";

const LANG = "ru-RU";
const DATE_FMT_FULL = new Intl.DateTimeFormat(LANG, {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const GUEST_LIMITS = {
  adults: { min: 1, max: 8 },
  children: { min: 0, max: 6 },
  infants: { min: 0, max: 4 },
};

// Module-level кэш destinations (не меняется в рамках сессии).
let _destinationsCache = null;

export async function preloadDestinations() {
  if (_destinationsCache) return _destinationsCache;
  _destinationsCache = await api.publicDestinations();
  return _destinationsCache;
}

// Открывает главный filter-drawer (все фильтры сгруппированы внутри
// шторки). `getState` — функция-геттер актуального state (не snapshot,
// чтобы после apply в sub-drawer'е перерисовать чипы filter-drawer'а).
export function openFilterDrawer(getState, onChange) {
  openTopDrawer({
    title: t("hotels.filter.open"),
    render: (body, close) => {
      const rerender = () => {
        const state = getState();
        renderFilterPanel(body, state, (patch) => {
          onChange(patch);
          rerender();
        });
        body.insertAdjacentHTML(
          "beforeend",
          `
          <div class="hfh-close-wrap">
            <button type="button" class="hfh-close-info" data-close>
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <path d="m15 9-6 6"/>
                <path d="m9 9 6 6"/>
              </svg>
              <span>${escapeHtml(t("hotels.filter.close"))}</span>
            </button>
          </div>
        `,
        );
        body.querySelector("[data-close]").addEventListener("click", close);
      };
      rerender();
    },
  });
}

function renderFilterPanel(container, state, onChange) {
  const hasFilters = Object.keys(state).length > 0;
  container.innerHTML = `
    <div class="hfp">
      <div class="hfh-row hfh-row--pair">
        ${chipHtml("destination", chipDestinationLabel(state))}
        ${chipHtml("guests", chipGuestsLabel(state))}
      </div>
      <div class="hfh-row hfh-row--pair">
        ${chipHtml("check_in", chipDateLabel(state.check_in, "check_in"))}
        ${chipHtml("check_out", chipDateLabel(state.check_out, "check_out"))}
      </div>
      <div class="hfh-row hfh-row--tools">
        ${chipHtml("sort", chipSortLabel(state))}
        <div class="hfh-search" data-search-mode="${state.q ? "expanded" : "collapsed"}">
          <button type="button" class="hfh-search-btn" aria-label="${escapeHtml(t("hotels.filter.search_placeholder"))}">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7"></circle>
              <path d="m20 20-3.5-3.5"></path>
            </svg>
          </button>
          <input type="search" class="hfh-search-input" value="${escapeHtml(state.q || "")}" placeholder="${escapeHtml(t("hotels.filter.search_placeholder"))}" />
          <button type="button" class="hfh-search-clear" aria-label="Clear">×</button>
        </div>
        ${hasFilters ? `
          <button type="button" class="hfh-reset" data-reset aria-label="${escapeHtml(t("filter.clear"))}" title="${escapeHtml(t("filter.clear"))}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <path d="m15 9-6 6"/>
              <path d="m9 9 6 6"/>
            </svg>
          </button>
        ` : ""}
      </div>
    </div>
  `;
  wireChips(container, state, onChange);
  wireSearch(container, state, onChange);
  const resetBtn = container.querySelector("[data-reset]");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      onChange({
        destination_id: null,
        check_in: null,
        check_out: null,
        adults: null,
        children: null,
        infants: null,
        q: null,
        sort: null,
      });
    });
  }
}

// ─── Chips ────────────────────────────────────────────────────────────

function chipHtml(key, label) {
  return `<button type="button" class="hfh-chip" data-chip="${key}">${escapeHtml(label)}</button>`;
}

function chipDestinationLabel(state) {
  const list = _destinationsCache || [];
  const found = state.destination_id
    ? list.find((d) => d.id === Number(state.destination_id))
    : null;
  return found ? found.name_ru : t("hotels.filter.destination");
}

function chipDateLabel(iso, kind) {
  if (iso) {
    const d = fromISO(iso);
    if (d) return DATE_FMT_FULL.format(d);
  }
  return kind === "check_in"
    ? t("hotels.filter.check_in")
    : t("hotels.filter.check_out");
}

function chipSortLabel(state) {
  if (state.sort === "price_asc") return t("hotels.filter.sort_price_asc");
  if (state.sort === "price_desc") return t("hotels.filter.sort_price_desc");
  return t("hotels.filter.sort");
}

function chipGuestsLabel(state) {
  const parts = [];
  if (state.adults) parts.push(`${state.adults} взр.`);
  if (state.children) parts.push(`${state.children} реб.`);
  if (state.infants) parts.push(`${state.infants} мл.`);
  return parts.length ? parts.join(" ") : t("hotels.filter.guests");
}

function wireChips(container, state, onChange) {
  container.querySelectorAll("[data-chip]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.chip;
      if (key === "destination") openDestinationDrawer(state, onChange);
      else if (key === "check_in") openDateDrawer("check_in", state, onChange);
      else if (key === "check_out") openDateDrawer("check_out", state, onChange);
      else if (key === "guests") openGuestsDrawer(state, onChange);
      else if (key === "sort") openSortDrawer(state, onChange);
    });
  });
}

// ─── Sort drawer ─────────────────────────────────────────────────────

function openSortDrawer(state, onChange) {
  const options = [
    { value: null, label: t("hotels.filter.sort_off") },
    { value: "price_asc", label: t("hotels.filter.sort_price_asc") },
    { value: "price_desc", label: t("hotels.filter.sort_price_desc") },
  ];
  openTopDrawer({
    title: t("hotels.filter.sort"),
    render: (body, close) => {
      const current = state.sort || null;
      body.innerHTML = `
        <div class="hfh-dest-list">
          ${options
            .map(
              (o) => `
            <button type="button" class="hfh-dest-row${current === o.value ? " active" : ""}" data-val="${o.value ?? ""}">
              <span class="hfh-dest-name">${escapeHtml(o.label)}</span>
              ${current === o.value ? '<span class="hfh-dest-check">✓</span>' : ""}
            </button>
          `,
            )
            .join("")}
        </div>
      `;
      body.querySelectorAll(".hfh-dest-row").forEach((row) => {
        row.addEventListener("click", () => {
          const val = row.dataset.val || null;
          onChange({ sort: val });
          close();
        });
      });
    },
  });
}

// ─── Search (expand-in-place) ────────────────────────────────────────

function wireSearch(container, state, onChange) {
  const wrap = container.querySelector(".hfh-search");
  const btn = wrap.querySelector(".hfh-search-btn");
  const input = wrap.querySelector(".hfh-search-input");
  const clear = wrap.querySelector(".hfh-search-clear");

  const setMode = (mode) => {
    wrap.dataset.searchMode = mode;
    if (mode === "expanded") setTimeout(() => input.focus(), 0);
  };

  btn.addEventListener("click", () => setMode("expanded"));

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const q = input.value.trim();
      onChange({ q: q || null });
    } else if (e.key === "Escape") {
      if (state.q) { onChange({ q: null }); }
      else { setMode("collapsed"); }
    }
  });

  input.addEventListener("blur", () => {
    const q = input.value.trim();
    if (q !== (state.q || "")) onChange({ q: q || null });
    if (!q) setMode("collapsed");
  });

  clear.addEventListener("click", () => {
    input.value = "";
    onChange({ q: null });
    setMode("collapsed");
  });
}

// ─── Destination drawer ───────────────────────────────────────────────

function openDestinationDrawer(state, onChange) {
  openTopDrawer({
    title: t("hotels.filter.destination"),
    render: async (body, close) => {
      body.innerHTML = `<p class="muted">${escapeHtml(t("common.loading"))}</p>`;
      let list;
      try {
        list = await preloadDestinations();
      } catch (e) {
        body.innerHTML = `<div class="error">${escapeHtml(e.message)}</div>`;
        return;
      }
      const rows = list
        .map(
          (d) => `
        <button type="button" class="hfh-dest-row${Number(state.destination_id) === d.id ? " active" : ""}" data-id="${d.id}">
          <span class="hfh-dest-name">${escapeHtml(d.name_ru)}</span>
          ${Number(state.destination_id) === d.id ? '<span class="hfh-dest-check">✓</span>' : ""}
        </button>
      `,
        )
        .join("");
      body.innerHTML = `
        <div class="hfh-dest-list">
          <button type="button" class="hfh-dest-row${!state.destination_id ? " active" : ""}" data-id="">
            <span class="hfh-dest-name muted">Все направления</span>
            ${!state.destination_id ? '<span class="hfh-dest-check">✓</span>' : ""}
          </button>
          ${rows}
        </div>
      `;
      body.querySelectorAll(".hfh-dest-row").forEach((row) => {
        row.addEventListener("click", () => {
          const id = row.dataset.id ? Number(row.dataset.id) : null;
          onChange({ destination_id: id });
          close();
        });
      });
    },
  });
}

// ─── Date drawer (single-month calendar) ─────────────────────────────

function openDateDrawer(field, state, onChange) {
  const initialIso = state[field] || null;
  const anchor = initialIso ? startOfMonth(fromISO(initialIso)) : startOfMonth(new Date());
  const today = todayISO();
  const minIso =
    field === "check_out" && state.check_in
      ? shiftIso(state.check_in, 1)
      : today;
  const maxIso =
    field === "check_in" && state.check_out
      ? shiftIso(state.check_out, -1)
      : null;
  let cursor = anchor;

  openTopDrawer({
    title: field === "check_in" ? t("hotels.filter.check_in") : t("hotels.filter.check_out"),
    render: (body, close) => {
      const draw = () => {
        body.innerHTML = calendarHtml(cursor, {
          selectedIso: initialIso,
          minIso,
          maxIso,
        });
        body.querySelector(".hfh-cal-prev").addEventListener("click", () => {
          cursor = addMonths(cursor, -1);
          draw();
        });
        body.querySelector(".hfh-cal-next").addEventListener("click", () => {
          cursor = addMonths(cursor, +1);
          draw();
        });
        body.querySelectorAll(".hfh-cal-day:not(.disabled)").forEach((el) => {
          el.addEventListener("click", () => {
            const iso = el.dataset.iso;
            const patch = { [field]: iso };
            // Даты в API отправляются только парой (backend валидирует).
            // Автозаполняем недостающее поле по разумному дефолту:
            //   check_in выбран → check_out = check_in + 1 (если пусто
            //     или уже ≤ check_in);
            //   check_out выбран → check_in = check_out - 1 (если пусто).
            if (field === "check_in" && (!state.check_out || state.check_out <= iso)) {
              patch.check_out = shiftIso(iso, 1);
            }
            if (field === "check_out" && !state.check_in) {
              patch.check_in = shiftIso(iso, -1);
            }
            onChange(patch);
            close();
          });
        });
      };
      draw();
    },
  });
}

function calendarHtml(monthAnchor, { selectedIso, minIso, maxIso }) {
  const cells = buildMonthGrid(monthAnchor);
  const monthIdx = monthAnchor.getMonth();
  const weekdays = weekdayShortNames(LANG);
  const dayCells = cells
    .map((d) => {
      const iso = toISO(d);
      const isOtherMonth = d.getMonth() !== monthIdx;
      const disabled = (minIso && iso < minIso) || (maxIso && iso > maxIso);
      const isSelected = iso === selectedIso;
      const cls = [
        "hfh-cal-day",
        isOtherMonth ? "muted" : "",
        disabled ? "disabled" : "",
        isSelected ? "selected" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<button type="button" class="${cls}" data-iso="${iso}" ${disabled ? "disabled" : ""}>${d.getDate()}</button>`;
    })
    .join("");
  return `
    <div class="hfh-cal">
      <div class="hfh-cal-head">
        <button type="button" class="hfh-cal-prev" aria-label="prev">‹</button>
        <div class="hfh-cal-title">${fmtMonthTitle(monthAnchor, LANG)}</div>
        <button type="button" class="hfh-cal-next" aria-label="next">›</button>
      </div>
      <div class="hfh-cal-weekdays">
        ${weekdays.map((w) => `<div class="hfh-cal-wd">${w}</div>`).join("")}
      </div>
      <div class="hfh-cal-grid">${dayCells}</div>
    </div>
  `;
}

function shiftIso(iso, delta) {
  const d = fromISO(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + delta);
  return toISO(d);
}

// ─── Guests drawer (counters) ────────────────────────────────────────

function openGuestsDrawer(state, onChange) {
  const draft = {
    adults: clamp(state.adults ?? 2, GUEST_LIMITS.adults.min, GUEST_LIMITS.adults.max),
    children: clamp(state.children ?? 0, GUEST_LIMITS.children.min, GUEST_LIMITS.children.max),
    infants: clamp(state.infants ?? 0, GUEST_LIMITS.infants.min, GUEST_LIMITS.infants.max),
  };

  openTopDrawer({
    title: t("hotels.filter.guests"),
    render: (body, close) => {
      const draw = () => {
        body.innerHTML = `
          <div class="hfh-guests">
            ${guestRowHtml("adults", draft.adults, t("rooms.guests.adults.title"))}
            ${guestRowHtml("children", draft.children, t("rooms.guests.children.title"))}
            ${guestRowHtml("infants", draft.infants, t("rooms.guests.infants.title"))}
            <div class="hfh-guests-apply">
              <button type="button" class="primary" data-apply>${escapeHtml(t("hotels.filter.apply"))}</button>
            </div>
          </div>
        `;
        body.querySelectorAll(".hfh-guests-row").forEach((row) => {
          const key = row.dataset.key;
          row.querySelector('[data-act="dec"]').addEventListener("click", () => updateGuest(key, -1));
          row.querySelector('[data-act="inc"]').addEventListener("click", () => updateGuest(key, +1));
        });
        body.querySelector("[data-apply]").addEventListener("click", () => {
          onChange({ ...draft });
          close();
        });
      };
      const updateGuest = (key, delta) => {
        const { min, max } = GUEST_LIMITS[key];
        const next = clamp(draft[key] + delta, min, max);
        if (next === draft[key]) return;
        draft[key] = next;
        draw();
      };
      draw();
    },
  });
}

function guestRowHtml(key, value, title) {
  const { min, max } = GUEST_LIMITS[key];
  return `
    <div class="hfh-guests-row" data-key="${key}">
      <div class="hfh-guests-title">${escapeHtml(title)}</div>
      <div class="hfh-guests-counter">
        <button type="button" data-act="dec" ${value <= min ? "disabled" : ""}>−</button>
        <span class="hfh-guests-value">${value}</span>
        <button type="button" data-act="inc" ${value >= max ? "disabled" : ""}>+</button>
      </div>
    </div>
  `;
}

function clamp(n, lo, hi) {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}
