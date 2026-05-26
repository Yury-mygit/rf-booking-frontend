// Book screen — форма подтверждения брони комнаты.
//
// Если юзер не в TG WebApp и не залогинен — показываем deep-link «открыть
// в Telegram» (с пред-заполненной комнатой/датами/гостями через startapp).
// Если в TG но без токена — авто-`/auth/tg` через initData.
// Успешное создание → /client/pay/<code>.

import { api } from "../../../api.js";
import { getLang, t } from "../../../i18n.js";
import { navigate, getQuery } from "../../../router.js";
import { setTitle, showBack } from "../../../topbar.js";
import { setBottomNav } from "../../../bottomnav.js";
import { inTelegram, tg } from "../../../tg.js";
import { mountDateRange } from "../../../widgets/daterange.js";
import { clientNavItems } from "../../nav.js";

import { ensureHotel, escapeHtml, hotelHash } from "./_shared.js";

const CLIENT_BOT = "rforge_stay_bot";

function buildTelegramDeepLink(hotelSlug, ci, co, g) {
  const base = `hotel_${hotelSlug}`;
  const sp = ci && co ? `${base}_${ci}_${co}_${g || 1}` : base;
  return `https://t.me/${CLIENT_BOT}?startapp=${sp}`;
}

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
