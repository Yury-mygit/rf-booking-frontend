// Services screen — список услуг отеля. Локализованная цена с снятием
// «/ночь» суффикса (общий ключ price_per_night заточен под комнаты).

import { t } from "../../../i18n.js";
import { navigate } from "../../../router.js";
import { setTitle, showBack } from "../../../topbar.js";
import { setBottomNav } from "../../../bottomnav.js";
import { clientNavItems } from "../../nav.js";

import { ensureHotel, escapeHtml, hotelHash } from "./_shared.js";

export async function renderHotelServices({ id }) {
  const app = document.getElementById("app");
  app.innerHTML = `<p>${t("common.loading")}</p>`;
  let h;
  try {
    h = await ensureHotel(id);
  } catch (e) {
    app.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    return;
  }
  setTitle(t("client.nav.services"));
  showBack(() => navigate(hotelHash(h)));
  setBottomNav(clientNavItems("hotel"));
  if (!h.services || !h.services.length) {
    app.innerHTML = `<p class="muted">${t("services.empty")}</p>`;
    return;
  }
  app.innerHTML = h.services.map((s) => `
    <div class="card">
      <h3>${escapeHtml(s.name_ru)}</h3>
      <div class="price">${servicePriceText(s)}</div>
    </div>
  `).join("");
}

function servicePriceText(s) {
  if (s.price_kgs == null) return t("services.free");
  // hotel.price_per_night содержит /ночь — для услуги это не уместно.
  return t("hotel.price_per_night", { price: s.price_kgs })
    .replace("/ночь", "")
    .replace("/night", "")
    .replace("/түнгө", "");
}
