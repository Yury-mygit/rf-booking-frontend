// Booking details view (#/client/bookings/<code>/details). Пока показывает
// только саму карточку брони — точно ту же, что и в списке /bookings.

import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { navigate } from "../../router.js";
import { setTitle, showBack } from "../../topbar.js";
import { setBottomNav } from "../../bottomnav.js";
import { CHAT_ICON_SVG, openChatWithHotel } from "./chat/open.js";
import { bookingCardHtml, statusText, escapeHtml } from "./bookings_card.js";

export async function renderBookingDetails({ code }) {
  setTitle(t("my.details_title"));
  showBack(() => navigate("#/client/bookings"));
  setBottomNav([]);

  const app = document.getElementById("app");
  app.innerHTML = `<p>${t("common.loading")}</p>`;

  if (!api.hasToken()) {
    app.innerHTML = `<p class="muted">${t("my.need_auth")} <a href="#/client/login">${t("my.dev_login")}</a></p>`;
    return;
  }

  let b;
  try {
    b = await api.getBooking(code);
  } catch (e) {
    app.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    return;
  }

  const canRequestCancel =
    b.confirmed && b.status !== "cancelled" && b.status !== "refunded";
  const cancelBtnHtml = canRequestCancel
    ? `<div class="details-actions"><button type="button" class="danger" id="request-cancel-btn">${t("cancel_req.action")}</button></div>`
    : "";
  app.innerHTML =
    bookingCardHtml(b, { withDetailsBtn: false, payFrom: "booking_details" })
    + cancelBtnHtml;

  const chatBtn = app.querySelector("button[data-chat-booking-id]");
  if (chatBtn) chatBtn.addEventListener("click", () => {
    openChatWithHotel(b.hotel_id, {
      type: "booking",
      id: b.id,
      name: t("my.code", { code: b.code }),
      extra: t("my.dates", { ci: b.check_in, co: b.check_out }),
    });
  });

  const cancelBtn = app.querySelector("#request-cancel-btn");
  if (cancelBtn) cancelBtn.addEventListener("click", () => {
    // replaceState — форма не оседает в history; TG-Back из /cancel
    // вернёт туда, откуда пришёл в details (обычно /client/bookings).
    const target = `#/client/bookings/${encodeURIComponent(code)}/cancel`;
    history.replaceState({}, "", target);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}
