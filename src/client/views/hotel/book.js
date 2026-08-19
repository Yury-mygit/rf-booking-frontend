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
import { hideBottomNav } from "../../../bottomnav.js";
import { inTelegram, tg } from "../../../tg.js";
import { fmtShort } from "../../../widgets/calendar_utils.js";
import { showToast } from "../../../widgets/toast.js";
import {
  ROOM_AMENITIES_BY_SECTION,
  ROOM_PAID_ALLOWED,
} from "../../../widgets/amenities_spec.js";
import { amenityIconHtml } from "../../../widgets/amenities_icons.js";

import {
  bindChipTooltips,
  ensureHotel,
  escapeHtml,
  formatGuestsLabel,
  hotelAmenitiesChipsHtml,
  hotelHash,
  preserveGuestsQuery,
  readGuestsFromQuery,
} from "./_shared.js";

const CLIENT_BOT = "rforge_stay_bot";

// deep-link backwards-compatible format `_<ci>_<co>_<sum>` (#125 tg.py
// regex принимает 1-3 trailing ints; sum достаточно для slug-парсера).
function buildTelegramDeepLink(hotelSlug, ci, co, guests) {
  const base = `hotel_${hotelSlug}`;
  const sum = guests.adults + guests.children + guests.infants;
  const sp = ci && co ? `${base}_${ci}_${co}_${sum || 1}` : base;
  return `https://t.me/${CLIENT_BOT}?startapp=${sp}`;
}

export async function renderHotelBookConfirm({ id, roomId }) {
  const app = document.getElementById("app");
  app.innerHTML = `<p>${t("common.loading")}</p>`;
  const q = getQuery();
  // На /book не передаём guests/beds в hotelDetails — иначе бэк (#95)
  // отфильтрует уже выбранный юзером номер и find(roomId) вернёт undefined
  // («Номер не найден»). check_in/check_out оставляем — нужны бэку для
  // available_for_dates и total_kgs_for_dates на этом конкретном номере.
  const detailsQ = {};
  if (q.check_in) detailsQ.check_in = q.check_in;
  if (q.check_out) detailsQ.check_out = q.check_out;
  let h;
  try {
    h = await ensureHotel(id, detailsQ);
  } catch (e) {
    app.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    return;
  }
  setTitle(t("client.nav.book"));
  // Возврат на /rooms сохраняем все активные фильтры из URL —
  // иначе юзер «теряет» выбранные guests/beds/check_in/out.
  const backQs = new URLSearchParams();
  if (q.check_in) backQs.set("check_in", q.check_in);
  if (q.check_out) backQs.set("check_out", q.check_out);
  preserveGuestsQuery(backQs, q);
  if (q.beds) backQs.set("beds", q.beds);
  const backTail = backQs.toString() ? "/rooms?" + backQs.toString() : "/rooms";
  showBack(() => navigate(hotelHash(h, backTail)));
  hideBottomNav();
  document.body.classList.add("has-book-confirm-bar");

  const r = (h.rooms || []).find((x) => x.id === Number(roomId));
  if (!r) {
    app.innerHTML = `<p class="error">${t("book.room_not_found")}</p>`;
    return;
  }
  const datesPicked = Boolean(q.check_in && q.check_out);
  const guests = readGuestsFromQuery(q);
  // UX-cap: structural input уже clamped в picker'е; здесь подстраховка
  // на случай прямой ссылки с adults > capacity (бэк всё равно 400).
  if (guests.adults + guests.children > r.capacity) {
    guests.adults = Math.min(guests.adults, r.capacity);
    guests.children = Math.max(0, r.capacity - guests.adults);
  }
  const lang = getLang();
  const datesLine = datesPicked
    ? `${fmtShort(q.check_in, lang)} → ${fmtShort(q.check_out, lang)}`
    : t("rooms.dates_required");
  app.innerHTML = `
    <div class="card room-card">
      ${roomPhotosHtml(r)}
      <div class="room-card-body">
        <h2>${escapeHtml(r.name_ru)}</h2>
        <div class="meta">${t("hotel.capacity", { n: r.capacity })}${r.beds != null ? ` · ${t("hotel.beds", { n: r.beds })}` : ""}</div>
        <div class="price">${t("hotel.price_per_night", { price: r.price_kgs })}</div>
      </div>
    </div>
    <div class="modal-summary ${datesPicked ? "" : "muted"}">
      <div>${escapeHtml(datesLine)}</div>
      <div>${escapeHtml(formatGuestsLabel(guests))}</div>
    </div>
    ${checkinCheckoutHtml(h)}
    ${amenitiesSectionsHtml(h, r)}
    <div id="m-err" class="error"></div>
    <div class="book-confirm-bar">
      <button class="primary full ${datesPicked ? "" : "is-disabled"}" id="m-ok">${t("rooms.confirm")}</button>
    </div>
  `;
  document.getElementById("m-ok").onclick = () =>
    submitBookConfirm(h, r, q, guests, datesPicked);
  bindChipTooltips(app);
}

function roomPhotosHtml(r) {
  const photos = r.photos || [];
  if (!photos.length) return "";
  return `<div class="room-photos-carousel">
    ${photos.map((p) => `<img class="room-photo-slide" src="${escapeHtml(p)}" alt="" />`).join("")}
  </div>`;
}

function fmtTime(v) {
  if (!v) return "";
  return v.slice(0, 5); // "HH:MM:SS" → "HH:MM"
}

function checkinCheckoutHtml(h) {
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

function amenitiesSectionsHtml(h, r) {
  const roomItems = r.amenities || [];
  const roomByKind = new Map(roomItems.map((it) => [it.kind, it]));

  // Room-level секции — hotel-часть выведена в helper (_shared.js).
  const roomSections = [];
  for (const sec of ROOM_AMENITIES_BY_SECTION) {
    const picked = sec.kinds.filter((k) => roomByKind.has(k));
    if (picked.length) roomSections.push({
      key: sec.section,
      chips: picked.map((k) => ({ kind: k, paid: roomByKind.get(k).paid === true && ROOM_PAID_ALLOWED.has(k) })),
    });
  }
  const roomHtml = roomSections.map((s) => `
    <div class="amenities-block">
      <div class="amenities-section-title">${escapeHtml(t("amenity.section." + s.key))}</div>
      <div class="amenities-chips">
        ${s.chips.map((c) => {
          const label = escapeHtml(t("amenity." + c.kind) + (c.paid ? " · " + t("amenity.paid") : ""));
          return `<span class="chip-icon ${c.paid ? "is-paid" : ""}" data-kind="${c.kind}" title="${label}" aria-label="${label}">
            ${amenityIconHtml(c.kind)}
            ${c.paid ? `<span class="chip-paid">₽</span>` : ""}
          </span>`;
        }).join("")}
      </div>
    </div>
  `).join("");
  return hotelAmenitiesChipsHtml(h) + roomHtml;
}

async function submitBookConfirm(h, r, q, guests, datesPicked) {
  if (!datesPicked) {
    showToast(t("rooms.dates_required"));
    return;
  }
  const err = document.getElementById("m-err");
  const ci = q.check_in;
  const co = q.check_out;
  if (!inTelegram && !api.hasToken()) {
    const link = buildTelegramDeepLink(h.slug, ci, co, guests);
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
    const payload = {
      room_id: r.id,
      check_in: ci,
      check_out: co,
      adults: guests.adults,
      children: guests.children,
      infants: guests.infants,
    };
    if (guests.children > 0 && guests.child_ages.length > 0) {
      payload.child_ages = guests.child_ages;
    }
    const b = await api.createBooking(payload);
    navigate(`#/client/pay/${b.code}`);
  } catch (e) {
    err.textContent = t("common.error", { msg: e.message });
  }
}
