import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { navigate } from "../../router.js";
import { setTitle, showBack } from "../../topbar.js";
import { setBottomNav } from "../../bottomnav.js";
import { setFilterBar } from "../../filterbar.js";
import { clientNavItems } from "../nav.js";
import { openChatWithHotel } from "./chat/open.js";
import { bookingCardHtml, DOLLAR_ICON_SVG } from "./bookings_card.js";

const PAY_CYCLE = ["all", "paid", "unpaid"];

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

  let scope = "all";       // all | actual
  let payFilter = "all";   // all | paid | unpaid

  const renderFilter = () => {
    setFilterBar([
      {
        key: "all",
        label: t("bookings.filter.all"),
        onClick: () => { scope = "all"; renderFilter(); renderList(); },
        active: scope === "all",
      },
      {
        key: "actual",
        label: t("bookings.filter.actual"),
        onClick: () => { scope = "actual"; renderFilter(); renderList(); },
        active: scope === "actual",
      },
      {
        key: "pay",
        icon: DOLLAR_ICON_SVG,
        onClick: () => {
          const i = PAY_CYCLE.indexOf(payFilter);
          payFilter = PAY_CYCLE[(i + 1) % PAY_CYCLE.length];
          renderFilter();
          renderList();
        },
        variant: `pay-${payFilter}`,
      },
    ]);
  };

  const renderList = () => {
    const today = new Date().toISOString().slice(0, 10);
    const filtered = items.filter((b) => {
      if (scope === "actual" && b.check_out < today) return false;
      if (payFilter === "paid" && b.status !== "paid") return false;
      if (payFilter === "unpaid" && b.status === "paid") return false;
      return true;
    });
    if (!filtered.length) {
      app.innerHTML = `<p class="muted">${t("bookings.empty")}</p>`;
      return;
    }
    app.innerHTML = filtered.map((b) => bookingCardHtml(b)).join("");
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
  };

  renderFilter();
  renderList();
}
