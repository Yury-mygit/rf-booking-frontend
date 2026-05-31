import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { navigate } from "../../router.js";
import { setTitle, showBack } from "../../topbar.js";
import { setBottomNav } from "../../bottomnav.js";
import { clientNavItems } from "../nav.js";
import { openChatWithHotel } from "./chat/open.js";
import { bookingCardHtml } from "./bookings_card.js";

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

  app.innerHTML = items.map((b) => bookingCardHtml(b)).join("");

  app.querySelectorAll("button[data-chat-booking-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const bookingId = Number(btn.dataset.chatBookingId);
      const b = items.find((x) => x.id === bookingId);
      if (!b) return;
      openChatWithHotel(b.hotel_id, {
        type: "booking",
        id: bookingId,
        name: t("my.code", { code: b.code }),
        extra: t("my.dates", { ci: b.check_in, co: b.check_out }),
      });
    });
  });
}
