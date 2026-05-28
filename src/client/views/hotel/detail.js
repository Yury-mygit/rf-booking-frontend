// Detail screen — карточка отеля: фото + название + адрес + описание +
// (опционально) map-pin кнопка которая ведёт на /map.

import { t } from "../../../i18n.js";
import { navigate } from "../../../router.js";
import { setTitle, showBack } from "../../../topbar.js";
import { setBottomNav } from "../../../bottomnav.js";
import { clientNavItems } from "../../nav.js";

import { ensureHotel, escapeHtml, hotelHash, PIN_SVG } from "./_shared.js";

export async function renderHotelDetail({ id }) {
  const app = document.getElementById("app");
  app.innerHTML = `<p>${t("common.loading")}</p>`;
  let h;
  try {
    h = await ensureHotel(id);
  } catch (e) {
    app.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    return;
  }
  const titled = t("hotel.title_prefix") + h.name_ru;
  setTitle(titled);
  showBack(() => navigate("#/"));
  setBottomNav(clientNavItems("hotel"));
  const photo = (h.photos && h.photos[0]) || "";
  const addressText = [h.city, h.address].filter(Boolean).map(escapeHtml).join(" · ");
  const hasCoords = h.lat != null && h.lng != null;
  const pinBtn = hasCoords
    ? `<button class="map-pin-btn" id="hotel-map-btn" type="button" aria-label="${t("hotel.location_title")}" title="${t("hotel.location_title")}">${PIN_SVG}</button>`
    : "";
  app.innerHTML = `
    <div class="hotel-head-card">
      ${photo ? `<div class="hotel-head-photo" style="background-image:url('${escapeHtml(photo)}')"></div>` : ""}
      <div class="hotel-head-body">
        <h1>${escapeHtml(titled)}</h1>
        <div class="meta address-line">${addressText}${pinBtn}</div>
        ${h.description_ru ? `<p>${escapeHtml(h.description_ru)}</p>` : ""}
      </div>
    </div>
  `;
  const mapBtn = document.getElementById("hotel-map-btn");
  if (mapBtn) mapBtn.onclick = () => navigate(hotelHash(h, "/map"));
}
