// Единый renderer карточки брони — используется в списке /bookings и
// на view деталей. Возвращает HTML; chat-обработчики навешиваются
// caller'ом (через querySelector by data-attr).

import { t, tn } from "../../i18n.js";
import { CHAT_ICON_SVG } from "./chat/open.js";

const DETAILS_ICON_SVG = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;

const DOLLAR_ICON_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`;

export function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

export function statusText(b) {
  if (b.status === "pending") {
    return b.confirmed
      ? t("my.status.pending_confirmed")
      : t("my.status.pending_unconfirmed");
  }
  return t("my.status." + b.status);
}

export function bookingCardHtml(b, opts = {}) {
  const { withDetailsBtn = true } = opts;
  const hotelLine = b.hotel_name_ru
    ? `<div>${escapeHtml(b.hotel_name_ru)}</div>`
    : "";
  const photo = b.hotel_photo || "";
  const photoStyle = photo
    ? ` style="background-image:url('${escapeHtml(photo)}')"`
    : "";
  const paid = b.status === "paid";
  const payPill = `<a class="bk-pay-pill ${paid ? "paid" : "unpaid"}" href="#/client/pay/${b.code}" title="${escapeHtml(statusText(b))}" aria-label="${escapeHtml(statusText(b))}">${DOLLAR_ICON_SVG}</a>`;
  const detailsBtn = withDetailsBtn
    ? `<a class="bk-icon-btn" href="#/client/bookings/${b.code}/details" aria-label="${escapeHtml(t("my.details"))}" title="${escapeHtml(t("my.details"))}">${DETAILS_ICON_SVG}</a>`
    : "";
  const chatBtn = `<button class="bk-icon-btn" type="button" data-chat-booking-hotel="${b.hotel_id}" data-chat-booking-id="${b.id}" aria-label="${escapeHtml(t("chat.write_about_booking"))}" title="${escapeHtml(t("chat.write_about_booking"))}">${CHAT_ICON_SVG}</button>`;
  return `
    <div class="booking-card">
      <div class="booking-card-photo"${photoStyle}></div>
      <div class="booking-card-body">
        <div class="bk-codeline">
          <span class="meta">${t("my.code", { code: b.code })}</span>
          ${payPill}
        </div>
        ${hotelLine}
        <div class="bk-dates">${t("my.dates", { ci: b.check_in, co: b.check_out })}</div>
        <div>${tn("my.guests", b.guests)}</div>
      </div>
      <div class="booking-card-actions">
        ${detailsBtn}
        ${chatBtn}
      </div>
    </div>`;
}
