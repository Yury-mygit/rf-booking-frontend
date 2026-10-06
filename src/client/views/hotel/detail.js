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
  const navArrows = photos.length > 1
    ? `<button class="hpc-nav hpc-nav-prev" type="button" aria-label="${escapeHtml(t("common.prev") || "Назад")}" data-hpc-dir="-1"><svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="8.6,2.3 6,12 8.6,21.7"/></svg></button>
       <button class="hpc-nav hpc-nav-next" type="button" aria-label="${escapeHtml(t("common.next") || "Дальше")}" data-hpc-dir="1"><svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15.4,2.3 18,12 15.4,21.7"/></svg></button>`
    : "";
  const dots = photos.length > 1
    ? `<div class="hpc-dots">${photos.map((_, i) => `<span class="hpc-dot${i === 0 ? " active" : ""}"></span>`).join("")}</div>`
    : "";
  const photoFrame = photos.length
    ? `<div class="hotel-photos-wrap">
         <div class="hotel-photos-carousel">
           ${photos
             .map(
               (src) => `<div class="hotel-photo-slide is-loading">
               <img class="hotel-photo-slide-img" src="${escapeHtml(src)}" alt=""
                 onload="this.classList.add('is-loaded');this.parentElement.classList.remove('is-loading')"
                 onerror="this.parentElement.classList.remove('is-loading')">
             </div>`,
             )
             .join("")}
         </div>
         ${navArrows}
         ${dots}
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
      <button class="primary qa-btn" id="hotel-rooms-btn" type="button">${escapeHtml(t("client.hotel_book_btn"))}</button>
    </div>
  `;
  const chatBtn = document.getElementById("hotel-chat-btn");
  if (chatBtn) chatBtn.onclick = () => openChatWithHotel(h.id, null);
  document.getElementById("hotel-rooms-btn").onclick = () => navigate(hotelHash(h, "/rooms"));
  const carousel = app.querySelector(".hotel-photos-carousel");
  if (carousel) {
    app.querySelectorAll(".hpc-nav").forEach((btn) => {
      btn.onclick = () => {
        const dir = Number(btn.dataset.hpcDir) || 1;
        const w = carousel.clientWidth;
        carousel.scrollBy({ left: dir * w, behavior: "smooth" });
      };
    });
    const slides = Array.from(carousel.querySelectorAll(".hotel-photo-slide"));
    const dotsEls = Array.from(app.querySelectorAll(".hpc-dot"));
    if (slides.length > 1 && dotsEls.length === slides.length) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting && e.intersectionRatio >= 0.5) {
              const i = slides.indexOf(e.target);
              if (i >= 0) {
                dotsEls.forEach((d, j) => d.classList.toggle("active", j === i));
              }
            }
          });
        },
        { root: carousel, threshold: 0.6 },
      );
      slides.forEach((s) => io.observe(s));
    }
  }
  bindChipTooltips(app);
  ensureEventSource(h.slug || h.id, () => renderHotelDetail({ id }));
}
