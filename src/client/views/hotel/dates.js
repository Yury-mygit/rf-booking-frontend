// Dates picker — full-screen single-date view. Открывается с
// client/hotel/<slug>/dates?field=checkin|checkout. Constraint:
// для checkin disabled даты >= q.check_out; для checkout disabled
// даты <= q.check_in. Min — todayISO. Тап по разрешённой дате
// сразу navigate'ит на /rooms с обновлённым полем. Back (showBack
// callback) — отмена без записи.

import { getLang, t } from "../../../i18n.js";
import { navigate, getQuery } from "../../../router.js";
import { setTitle, showBack } from "../../../topbar.js";
import { setBottomNav } from "../../../bottomnav.js";
import {
  addMonths,
  buildMonthGrid,
  fmtMonthTitle,
  fromISO,
  startOfMonth,
  todayISO,
  toISO,
  weekdayShortNames,
} from "../../../widgets/calendar_utils.js";

import { ensureHotel, escapeHtml, hotelHash, preserveGuestsQuery } from "./_shared.js";

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
  const field = q.field === "checkout" ? "checkout" : "checkin";
  const targetKey = field === "checkin" ? "check_in" : "check_out";
  const picked = q[targetKey] || null;
  const minISO = todayISO();
  // upper bound для checkin = q.check_out (exclusive); lower bound
  // для checkout = q.check_in (exclusive). null = bound отсутствует.
  const upperExcl = field === "checkin" ? (q.check_out || null) : null;
  const lowerExcl = field === "checkout" ? (q.check_in || null) : null;

  const anchorISO = picked || (field === "checkout" && q.check_in) || (field === "checkin" && q.check_out) || todayISO();
  let monthAnchor = startOfMonth(fromISO(anchorISO));

  function backToRooms(extraQS) {
    const qs = new URLSearchParams();
    if (extraQS) {
      for (const [k, v] of extraQS) qs.set(k, v);
    } else {
      if (q.check_in) qs.set("check_in", q.check_in);
      if (q.check_out) qs.set("check_out", q.check_out);
    }
    preserveGuestsQuery(qs, q);
    if (q.beds) qs.set("beds", q.beds);
    const tail = qs.toString() ? `/rooms?${qs.toString()}` : "/rooms";
    navigate(hotelHash(h, tail));
  }

  showBack(() => backToRooms(null));

  function isDisabled(iso) {
    if (iso < minISO) return true;
    if (upperExcl && iso >= upperExcl) return true;
    if (lowerExcl && iso <= lowerExcl) return true;
    return false;
  }

  function pickDay(iso) {
    if (isDisabled(iso)) return;
    const next = new URLSearchParams();
    if (field === "checkin") {
      next.set("check_in", iso);
      if (q.check_out) next.set("check_out", q.check_out);
    } else {
      if (q.check_in) next.set("check_in", q.check_in);
      next.set("check_out", iso);
    }
    backToRooms(next);
  }

  function render() {
    const cells = buildMonthGrid(monthAnchor);
    const weekdays = weekdayShortNames(lang);
    const today = todayISO();
    const gridHtml = cells.map((d) => {
      const iso = toISO(d);
      const inMonth = d.getMonth() === monthAnchor.getMonth();
      const disabled = isDisabled(iso);
      const isPicked = picked && iso === picked;
      const isToday = iso === today;
      const cls = [
        "dates-day",
        inMonth ? "" : "out-month",
        disabled ? "disabled" : "",
        isPicked ? "picked" : "",
        isToday ? "today" : "",
      ].filter(Boolean).join(" ");
      return `<button type="button" class="${cls}" data-iso="${iso}" ${disabled ? "disabled" : ""}>${d.getDate()}</button>`;
    }).join("");

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
  }

  render();
}
