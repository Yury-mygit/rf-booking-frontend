// Detail screen — карточка отеля: фото + название + адрес + описание +
// удобства чипсами + блок «Местоположение» (embedded OSM + 2GIS).

import { t } from "../../../i18n.js";
import { navigate } from "../../../router.js";
import { setTitle, showBack } from "../../../topbar.js";
import { hideBottomNav } from "../../../bottomnav.js";
import { CHAT_ICON_SVG, openChatWithHotel } from "../chat/open.js";

import { bindChipTooltips, ensureEventSource, ensureHotel, escapeHtml, hotelAccentsHtml, hotelAmenitiesChipsHtml, hotelCheckinCheckoutHtml, hotelHash, hotelLocationHtml, hotelRulesHtml } from "./_shared.js";

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
  showBack(() => navigate("#/client/hotels"));
  hideBottomNav();
  document.body.classList.add("has-hotel-actions");
  const photos = Array.isArray(h.photos) ? h.photos.filter(Boolean) : [];
  const addressText = [h.city, h.address].filter(Boolean).map(escapeHtml).join(" · ");
  // Photo-frame рендерится всегда (сохраняет 1:1 разметку). Один-N фото →
  // горизонтальная карусель со scroll-snap; 0 фото — плоский плейсхолдер.
  // Shimmer на каждом слайде до onload/onerror; onerror снимает shimmer
  // и оставляет surface-soft фон (без alt-битой иконки).
  const photoFrame = photos.length
    ? `<div class="hotel-photos-carousel">
         ${photos
           .map(
             (src) => `<div class="hotel-photo-slide is-loading">
             <img class="hotel-photo-slide-img" src="${escapeHtml(src)}" alt=""
               onload="this.classList.add('is-loaded');this.parentElement.classList.remove('is-loading')"
               onerror="this.parentElement.classList.remove('is-loading')">
           </div>`,
           )
           .join("")}
       </div>`
    : `<div class="hotel-head-photo"></div>`;
  app.innerHTML = `
    <div class="hotel-head-card">
      ${photoFrame}
      <div class="hotel-head-body">
        <div class="hotel-head-titlerow">
          <h1>${escapeHtml(titled)}</h1>
          <button class="chat-icon-btn" id="hotel-chat-btn" type="button"
            aria-label="${escapeHtml(t("chat.write_to_hotel"))}"
            title="${escapeHtml(t("chat.write_to_hotel"))}">${CHAT_ICON_SVG}</button>
        </div>
        <div class="meta">${addressText}</div>
        ${hotelAccentsHtml(h)}
        ${h.description_ru ? `<p>${escapeHtml(h.description_ru)}</p>` : ""}
      </div>
    </div>
    ${hotelAmenitiesChipsHtml(h)}
    ${hotelLocationHtml(h)}
    ${hotelCheckinCheckoutHtml(h)}
    ${hotelRulesHtml(h)}
    <div class="hotel-quick-actions">
      <button class="primary qa-btn" id="hotel-rooms-btn" type="button">${escapeHtml(t("client.nav.rooms"))}</button>
    </div>
  `;
  const chatBtn = document.getElementById("hotel-chat-btn");
  if (chatBtn) chatBtn.onclick = () => openChatWithHotel(h.id, null);
  document.getElementById("hotel-rooms-btn").onclick = () => navigate(hotelHash(h, "/rooms"));
  bindChipTooltips(app);
  ensureEventSource(h.slug || h.id, () => renderHotelDetail({ id }));
}
