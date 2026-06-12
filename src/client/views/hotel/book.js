// Book screen — форма подтверждения брони комнаты.
//
// Если юзер не в TG WebApp и не залогинен — показываем deep-link «открыть
// в Telegram» (с пред-заполненной комнатой/датами/гостями через startapp).
// Если в TG но без токена — авто-`/auth/tg` через initData.
// Успешное создание → /client/pay/<code>.

import { api } from "../../../api.js";
import { getLang, t, tn } from "../../../i18n.js";
import { navigate, getQuery } from "../../../router.js";
import { setTitle, showBack } from "../../../topbar.js";
import { setBottomNav } from "../../../bottomnav.js";
import { inTelegram, tg } from "../../../tg.js";
import { fmtShort } from "../../../widgets/calendar_utils.js";
import { showToast } from "../../../widgets/toast.js";
import {
  HOTEL_AMENITIES_BY_SECTION,
  ROOM_AMENITIES_BY_SECTION,
  ROOM_PAID_ALLOWED,
} from "../../../widgets/amenities_spec.js";
import { amenityIconHtml } from "../../../widgets/amenities_icons.js";
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
  setBottomNav(clientNavItems("rooms"));
  document.body.classList.add("has-book-confirm-bar");

  const r = (h.rooms || []).find((x) => x.id === Number(roomId));
  if (!r) {
    app.innerHTML = `<p class="error">${t("book.room_not_found")}</p>`;
    return;
  }
  const datesPicked = Boolean(q.check_in && q.check_out);
  const guests = Math.min(Number(q.guests) || 1, r.capacity);
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
      <div>${escapeHtml(tn("hotel.guests", guests))}</div>
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
  app.querySelectorAll(".chip-icon[data-kind]").forEach((el) => {
    el.addEventListener("click", () => {
      const label = el.getAttribute("aria-label") || el.getAttribute("title") || "";
      if (label) showChipTip(el, label);
    });
  });
}

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
  const hotelKinds = new Set(h.amenities || []);
  const roomItems = r.amenities || [];
  const roomByKind = new Map(roomItems.map((it) => [it.kind, it]));

  const sections = [];
  // Hotel-level
  for (const sec of HOTEL_AMENITIES_BY_SECTION) {
    const picked = sec.kinds.filter((k) => hotelKinds.has(k));
    if (picked.length) sections.push({ key: sec.section, chips: picked.map((k) => ({ kind: k })) });
  }
  // Room-level
  for (const sec of ROOM_AMENITIES_BY_SECTION) {
    const picked = sec.kinds.filter((k) => roomByKind.has(k));
    if (picked.length) sections.push({
      key: sec.section,
      chips: picked.map((k) => ({ kind: k, paid: roomByKind.get(k).paid === true && ROOM_PAID_ALLOWED.has(k) })),
    });
  }
  if (!sections.length) return "";
  return sections.map((s) => `
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
}

async function submitBookConfirm(h, r, q, g, datesPicked) {
  if (!datesPicked) {
    showToast(t("rooms.dates_required"));
    return;
  }
  const err = document.getElementById("m-err");
  const ci = q.check_in;
  const co = q.check_out;
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
