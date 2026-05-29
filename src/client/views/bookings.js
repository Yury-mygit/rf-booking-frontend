import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { navigate } from "../../router.js";
import { setTitle, showBack } from "../../topbar.js";
import { setBottomNav } from "../../bottomnav.js";
import { clientNavItems } from "../nav.js";
import { CHAT_ICON_SVG, openChatWithHotel } from "./chat/open.js";

function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function statusText(b) {
  if (b.status === "pending") {
    return b.confirmed
      ? t("my.status.pending_confirmed")
      : t("my.status.pending_unconfirmed");
  }
  return t("my.status." + b.status);
}

export async function renderBookings() {
  setTitle(t("client.nav.bookings"));
  showBack(() => navigate("#/"));
  setBottomNav(clientNavItems("bookings"));

  const app = document.getElementById("app");
  app.innerHTML = `<p>${t("common.loading")}</p>`;

  if (!api.hasToken()) {
    app.innerHTML = `<p class="muted">${t("my.need_auth")} <a href="#/client/login">${t("my.dev_login")}</a></p>`;
    return;
  }

  let items;
  try {
    items = await api.myBookings();
  } catch (e) {
    app.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    return;
  }

  if (!items.length) {
    app.innerHTML = `<p class="muted">${t("bookings.empty")}</p>`;
    return;
  }

  app.innerHTML = items
    .map((b) => {
      const hotelLine = b.hotel_name_ru
        ? `<div>${escapeHtml(b.hotel_name_ru)}</div>`
        : "";
      const payBtn =
        b.status === "pending" && !b.postpay
          ? `<a class="primary" href="#/client/pay/${b.code}">${t("my.pay")}</a>`
          : "";
      const writeBtn = `<button class="chat-icon-btn" type="button" data-chat-booking-hotel="${b.hotel_id}" data-chat-booking-id="${b.id}" aria-label="${escapeHtml(t("chat.write_about_booking"))}" title="${escapeHtml(t("chat.write_about_booking"))}">${CHAT_ICON_SVG}</button>`;
      const actions = `<div class="bk-actions" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">${payBtn}${writeBtn}</div>`;
      return `
        <div class="card">
          <div class="meta">${t("my.code", { code: b.code })}</div>
          ${hotelLine}
          <div>${t("my.dates", { ci: b.check_in, co: b.check_out })} · ${t("my.guests", { n: b.guests })}</div>
          <div class="price">${t("my.total", { total: b.total_kgs })}</div>
          <div class="meta">${statusText(b)}</div>
          ${actions}
        </div>`;
    })
    .join("");

  app.querySelectorAll("button[data-chat-booking-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const hotelId = Number(btn.dataset.chatBookingHotel);
      const bookingId = Number(btn.dataset.chatBookingId);
      openChatWithHotel(hotelId, { type: "booking", id: bookingId });
    });
  });
}
