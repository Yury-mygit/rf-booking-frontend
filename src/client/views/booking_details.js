// Booking details view (#/client/bookings/<code>/details). Пока показывает
// только саму карточку брони — точно ту же, что и в списке /bookings.

import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { navigate } from "../../router.js";
import { setTitle, showBack } from "../../topbar.js";
import { setBottomNav } from "../../bottomnav.js";
import { CHAT_ICON_SVG, openChatWithHotel } from "./chat/open.js";
import { bookingCardHtml, escapeHtml } from "./bookings_card.js";
import { CHAT_ICON_SVG as CHAT_SVG } from "./chat/open.js";

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

  app.innerHTML = bookingCardHtml(b, {
    withDetailsBtn: false,
    detailsMode: true,
  });

  const card = app.querySelector(".booking-card.details-mode");

  // Chat — нижний правый угол карточки.
  const chatBtnHtml = `
    <button type="button" class="booking-card-chat-corner" aria-label="${escapeHtml(t("chat.write_about_booking"))}" title="${escapeHtml(t("chat.write_about_booking"))}">
      ${CHAT_SVG}
    </button>`;
  card.insertAdjacentHTML("beforeend", chatBtnHtml);
  card.querySelector(".booking-card-chat-corner").addEventListener("click", () => {
    openChatWithHotel(b.hotel_id, {
      type: "booking",
      id: b.id,
      name: t("my.code", { code: b.code }),
      extra: t("my.dates", { ci: b.check_in, co: b.check_out }),
    });
  });

  // ✕ — верхний правый угол карточки (только для confirmed && не отменённых).
  if (canRequestCancel) {
    const cancelBtnHtml = `
      <button type="button" class="booking-card-cancel-corner" aria-label="${escapeHtml(t("cancel_req.action"))}" title="${escapeHtml(t("cancel_req.action"))}">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>`;
    card.insertAdjacentHTML("beforeend", cancelBtnHtml);
    card.querySelector(".booking-card-cancel-corner").addEventListener("click", () => {
      const target = `#/client/bookings/${encodeURIComponent(code)}/cancel`;
      history.replaceState({}, "", target);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
  }
}
