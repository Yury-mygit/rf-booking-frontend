// Map screen — embedded OSM iframe + кнопка «открыть в 2gis».
// Если у отеля нет координат — показываем muted-плашку.

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { navigate } from "../../../router.js";
import { setTitle, showBack } from "../../../topbar.js";
import { setLastHotel } from "../../state.js";

import { _state, matchesCached, escapeHtml, hotelHash } from "./_shared.js";

export async function renderHotelMap({ id }) {
  const app = document.getElementById("app");
  app.innerHTML = `<p>${t("common.loading")}</p>`;
  let h = matchesCached(id) ? _state.hotel : null;
  if (!h) {
    try {
      h = await api.hotelDetails(id, {});
      _state.hotel = h;
      setLastHotel(h);
    } catch (e) {
      app.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
      return;
    }
  }
  setTitle(t("hotel.location_title"));
  showBack(() => {
    if (history.length > 1) history.back();
    else navigate(hotelHash(h));
  });

  if (h.lat == null || h.lng == null) {
    app.innerHTML = `<p class="muted">${t("hotel.no_coords")}</p>`;
    return;
  }
  const lat = Number(h.lat);
  const lng = Number(h.lng);
  const d = 0.005;
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  const osmSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  const dgisHref = `https://2gis.kg/?m=${lng}%2C${lat}%2F17&pt=${lng},${lat}`;
  const addressLine = [h.city, h.address].filter(Boolean).map(escapeHtml).join(" · ");
  app.innerHTML = `
    <div class="map-screen">
      ${addressLine ? `<div class="meta map-address">${addressLine}</div>` : ""}
      <iframe class="map-frame" src="${osmSrc}" loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"></iframe>
      <div class="map-actions">
        <a class="primary" href="${dgisHref}" target="_blank" rel="noopener">
          ${t("hotel.open_in_2gis")}
        </a>
      </div>
    </div>
  `;
}
