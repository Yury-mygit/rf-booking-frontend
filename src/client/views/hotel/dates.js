// Dates picker — full-screen view. Открывается с client/hotel/<slug>/dates,
// возвращается на /rooms с применённым (Подтвердить) или сохранённым
// (Отмена) фильтром.
//
// Алгоритм: selection — массив ISO-дат, max 2. Click toggle'ит дату; 3-й
// клик (при 2 выделенных) сбрасывает selection и делает кликнутую якорем.
// На применение: 0 дат — фильтр снят; 1 — single-night (check_out = +1);
// 2 — check_in = min, check_out = max.

import { getLang, t } from "../../../i18n.js";
import { navigate, getQuery } from "../../../router.js";
import { setTitle, showBack } from "../../../topbar.js";
import { setBottomNav } from "../../../bottomnav.js";
import {
  addDays,
  addMonths,
  buildMonthGrid,
  fmtMonthTitle,
  fromISO,
  startOfMonth,
  todayISO,
  toISO,
  weekdayShortNames,
} from "../../../widgets/calendar_utils.js";

import { ensureHotel, escapeHtml, hotelHash } from "./_shared.js";

export async function renderHotelDates({ id }) {
  const app = document.getElementById("app");
  app.innerHTML = `<p>${t("common.loading")}</p>`;
  let h;
  try {
    h = await ensureHotel(id);
  } catch (e) {
    app.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    return;
  }
  setTitle(t("rooms.dates"));
  setBottomNav([]);

  const q = getQuery();
  const lang = getLang();
  const minISO = todayISO();
  const selection = [];
  if (q.check_in) selection.push(q.check_in);
  if (q.check_out && q.check_out !== q.check_in) selection.push(q.check_out);

  const anchor = selection[0] || todayISO();
  let monthAnchor = startOfMonth(fromISO(anchor));

  function cancel() {
    const qs = new URLSearchParams();
    if (q.check_in) qs.set("check_in", q.check_in);
    if (q.check_out) qs.set("check_out", q.check_out);
    if (q.guests) qs.set("guests", q.guests);
    const tail = qs.toString() ? `/rooms?${qs.toString()}` : "/rooms";
    navigate(hotelHash(h, tail));
  }

  function confirm() {
    const qs = new URLSearchParams();
    if (q.guests) qs.set("guests", q.guests);
    if (selection.length === 1) {
      const ci = selection[0];
      qs.set("check_in", ci);
      qs.set("check_out", toISO(addDays(fromISO(ci), 1)));
    } else if (selection.length === 2) {
      const sorted = [...selection].sort();
      qs.set("check_in", sorted[0]);
      qs.set("check_out", sorted[1]);
    }
    const tail = `/rooms?${qs.toString()}`;
    navigate(hotelHash(h, tail));
  }

  showBack(cancel);

  function pickDay(iso) {
    if (iso < minISO) return;
    const idx = selection.indexOf(iso);
    if (idx >= 0) {
      selection.splice(idx, 1);
    } else if (selection.length < 2) {
      selection.push(iso);
    } else {
      selection.length = 0;
      selection.push(iso);
    }
    render();
  }

  function render() {
    const sorted = [...selection].sort();
    const startISO = sorted[0] || null;
    const endISO = sorted[1] || null;
    const cells = buildMonthGrid(monthAnchor);
    const weekdays = weekdayShortNames(lang);
    const today = todayISO();
    const gridHtml = cells.map((d) => {
      const iso = toISO(d);
      const inMonth = d.getMonth() === monthAnchor.getMonth();
      const disabled = iso < minISO;
      const isStart = startISO && iso === startISO;
      const isEnd = endISO && iso === endISO;
      const inRange = startISO && endISO && iso > startISO && iso < endISO;
      const isToday = iso === today;
      const cls = [
        "dates-day",
        inMonth ? "" : "out-month",
        disabled ? "disabled" : "",
        isStart ? "range-start" : "",
        isEnd ? "range-end" : "",
        inRange ? "in-range" : "",
        isToday ? "today" : "",
      ].filter(Boolean).join(" ");
      return `<button type="button" class="${cls}" data-iso="${iso}" ${disabled ? "disabled" : ""}>${d.getDate()}</button>`;
    }).join("");

    const hasSelection = selection.length > 0;
    app.innerHTML = `
      <div class="dates-view">
        <div class="dates-month-head">
          <button type="button" class="dates-nav" data-nav="-1" aria-label="prev">‹</button>
          <div class="dates-month-title">${escapeHtml(fmtMonthTitle(monthAnchor, lang))}</div>
          <button type="button" class="dates-nav" data-nav="1" aria-label="next">›</button>
        </div>
        <div class="dates-weekdays">
          ${weekdays.map((n) => `<div class="dates-wd">${escapeHtml(n)}</div>`).join("")}
        </div>
        <div class="dates-grid">${gridHtml}</div>
        <div class="dates-actions">
          <button type="button" class="primary dates-confirm" id="dates-confirm">${escapeHtml(t("app.confirm"))}</button>
        </div>
      </div>
    `;

    app.querySelectorAll("[data-iso]").forEach((btn) => {
      btn.addEventListener("click", () => pickDay(btn.dataset.iso));
    });
    app.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => {
        monthAnchor = addMonths(monthAnchor, Number(btn.dataset.nav));
        render();
      });
    });
    document.getElementById("dates-confirm").addEventListener("click", confirm);
  }

  render();
}
