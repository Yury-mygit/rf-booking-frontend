// Vanilla date-range picker. No deps.
//
// API:
//   mountDateRange(container, {
//     start, end,            // ISO YYYY-MM-DD or null
//     minDate,               // ISO; default = today
//     lang,                  // ru | ky | en — for Intl formatting
//     labelIn, labelOut,     // placeholder labels
//     placeholderIn, placeholderOut,
//     onChange(start, end),  // both dates picked (or both cleared)
//   })
//
// State machine:
//   - click on either button → popup opens
//   - click day before start (or no start yet) → start = day, end = null (range-pick mode)
//   - click day >= start → end = day, popup closes, onChange fires
//   - hover in range-pick mode → preview highlight start..hover

const KEY_IN = "_dr_in";
const KEY_OUT = "_dr_out";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toISO(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function fromISO(s) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function todayISO() {
  return toISO(new Date());
}

function fmtShort(iso, lang) {
  if (!iso) return "";
  const d = fromISO(iso);
  return new Intl.DateTimeFormat(lang, { day: "2-digit", month: "short" }).format(d);
}

function fmtMonthTitle(d, lang) {
  return new Intl.DateTimeFormat(lang, { month: "long", year: "numeric" }).format(d);
}

function weekdayShortNames(lang) {
  // Monday-first week. Use a known Monday as anchor.
  const monday = new Date(2024, 0, 1); // Mon, 1 Jan 2024
  const fmt = new Intl.DateTimeFormat(lang, { weekday: "short" });
  const names = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    names.push(fmt.format(d));
  }
  return names;
}

function buildMonthGrid(monthAnchor) {
  // Returns array of 42 Date cells (6 weeks * 7 days), Monday-first.
  const first = startOfMonth(monthAnchor);
  // JS getDay(): 0=Sun..6=Sat. We want offset from Monday.
  const offset = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(first);
    d.setDate(first.getDate() - offset + i);
    cells.push(d);
  }
  return cells;
}

export function mountDateRange(container, opts) {
  const state = {
    start: opts.start || null,
    end: opts.end || null,
    minISO: opts.minDate || todayISO(),
    lang: opts.lang || "ru",
    pickAnchor: null, // ISO of clicked-first date when picking range
    monthAnchor: startOfMonth(fromISO(opts.start || todayISO())),
    hoverISO: null,
    open: false,
  };

  container.classList.add("dr-root");
  container.innerHTML = `
    <div class="dr-fields">
      <button type="button" class="dr-field" data-dr-target="in">
        <span class="dr-label">${opts.labelIn || ""}</span>
        <span class="dr-value" data-dr="in"></span>
      </button>
      <button type="button" class="dr-field" data-dr-target="out">
        <span class="dr-label">${opts.labelOut || ""}</span>
        <span class="dr-value" data-dr="out"></span>
      </button>
    </div>
    <div class="dr-popup" hidden>
      <div class="dr-popup-head">
        <button type="button" class="dr-nav" data-dr-nav="-1" aria-label="prev">‹</button>
        <div class="dr-month-title"></div>
        <button type="button" class="dr-nav" data-dr-nav="1" aria-label="next">›</button>
      </div>
      <div class="dr-weekdays"></div>
      <div class="dr-grid"></div>
    </div>
  `;

  const popup = container.querySelector(".dr-popup");
  const grid = container.querySelector(".dr-grid");
  const monthTitle = container.querySelector(".dr-month-title");
  const weekdaysEl = container.querySelector(".dr-weekdays");
  const fieldIn = container.querySelector('[data-dr-target="in"]');
  const fieldOut = container.querySelector('[data-dr-target="out"]');
  const valueInEl = container.querySelector('[data-dr="in"]');
  const valueOutEl = container.querySelector('[data-dr="out"]');

  weekdaysEl.innerHTML = weekdayShortNames(state.lang)
    .map((n) => `<div class="dr-wd">${n}</div>`)
    .join("");

  function renderFields() {
    valueInEl.textContent = state.start
      ? fmtShort(state.start, state.lang)
      : (opts.placeholderIn || "—");
    valueOutEl.textContent = state.end
      ? fmtShort(state.end, state.lang)
      : (opts.placeholderOut || "—");
    fieldIn.classList.toggle("empty", !state.start);
    fieldOut.classList.toggle("empty", !state.end);
  }

  function renderGrid() {
    monthTitle.textContent = fmtMonthTitle(state.monthAnchor, state.lang);
    const cells = buildMonthGrid(state.monthAnchor);
    const minISO = state.minISO;
    const startISO = state.pickAnchor || state.start;
    const endISO = state.pickAnchor ? null : state.end;
    const hoverISO = state.pickAnchor && state.hoverISO && state.hoverISO >= startISO ? state.hoverISO : null;

    grid.innerHTML = cells
      .map((d) => {
        const iso = toISO(d);
        const inMonth = d.getMonth() === state.monthAnchor.getMonth();
        const disabled = iso < minISO;
        const isStart = startISO && iso === startISO;
        const isEnd = endISO && iso === endISO;
        const effEnd = endISO || hoverISO;
        const inRange = startISO && effEnd && iso > startISO && iso < effEnd;
        const isToday = iso === todayISO();
        const cls = [
          "dr-day",
          inMonth ? "" : "out-month",
          disabled ? "disabled" : "",
          isStart ? "range-start" : "",
          isEnd ? "range-end" : "",
          inRange ? "in-range" : "",
          isToday ? "today" : "",
        ].filter(Boolean).join(" ");
        return `<button type="button" class="${cls}" data-dr-day="${iso}" ${disabled ? "disabled" : ""}>${d.getDate()}</button>`;
      })
      .join("");
  }

  function openPopup(targetField) {
    state.open = true;
    state.pickAnchor = targetField === "out" && state.start ? state.start : null;
    if (state.start) state.monthAnchor = startOfMonth(fromISO(state.start));
    popup.hidden = false;
    renderGrid();
    setTimeout(() => document.addEventListener("click", onDocClick, true), 0);
  }

  function closePopup() {
    state.open = false;
    state.pickAnchor = null;
    state.hoverISO = null;
    popup.hidden = true;
    document.removeEventListener("click", onDocClick, true);
  }

  function onDocClick(e) {
    if (!container.contains(e.target)) closePopup();
  }

  function pickDay(iso) {
    if (iso < state.minISO) return;
    if (!state.pickAnchor) {
      // First click — set start, await end.
      state.pickAnchor = iso;
      state.start = iso;
      state.end = null;
      renderFields();
      renderGrid();
      return;
    }
    if (iso < state.pickAnchor) {
      // User clicked earlier than anchor → restart picking.
      state.start = iso;
      state.pickAnchor = iso;
      state.end = null;
      renderFields();
      renderGrid();
      return;
    }
    // Second click ≥ anchor → confirm end.
    state.start = state.pickAnchor;
    state.end = iso;
    state.pickAnchor = null;
    renderFields();
    closePopup();
    if (opts.onChange) opts.onChange(state.start, state.end);
  }

  container.addEventListener("click", (e) => {
    const fieldBtn = e.target.closest("[data-dr-target]");
    if (fieldBtn) {
      if (state.open) closePopup();
      else openPopup(fieldBtn.dataset.drTarget);
      return;
    }
    const navBtn = e.target.closest("[data-dr-nav]");
    if (navBtn) {
      state.monthAnchor = addMonths(state.monthAnchor, Number(navBtn.dataset.drNav));
      renderGrid();
      return;
    }
    const dayBtn = e.target.closest("[data-dr-day]");
    if (dayBtn && !dayBtn.disabled) {
      pickDay(dayBtn.dataset.drDay);
    }
  });

  grid.addEventListener("mouseover", (e) => {
    if (!state.pickAnchor) return;
    const dayBtn = e.target.closest("[data-dr-day]");
    if (!dayBtn) return;
    const iso = dayBtn.dataset.drDay;
    if (iso === state.hoverISO) return;
    state.hoverISO = iso;
    renderGrid();
  });

  renderFields();

  return {
    getValue: () => ({ start: state.start, end: state.end }),
    setValue: (start, end) => {
      state.start = start || null;
      state.end = end || null;
      state.pickAnchor = null;
      renderFields();
      if (state.open) renderGrid();
    },
  };
}

// Keys so callers can stash the handle without name clashes.
mountDateRange.KEY_IN = KEY_IN;
mountDateRange.KEY_OUT = KEY_OUT;
