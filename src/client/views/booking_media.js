// Booking media view (#/client/bookings/<code>/media). Сетка 3-в-ряд
// для фото отеля + фото комнаты. Клик по миниатюре → lightbox.
//
// Секции динамические: если фото отеля нет — секция скрыта; если у
// комнаты нет фото — скрыта. Если совсем пусто — плейсхолдер.
// Lightbox pool — раздельный (внутри hotel / внутри room).

import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { navigate } from "../../router.js";
import { setTitle, showBack } from "../../topbar.js";
import { setBottomNav } from "../../bottomnav.js";
import { openLightbox } from "../../widgets/lightbox.js";
import { mediaUrl } from "../../widgets/media_url.js";

function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function sectionHtml(title, photos, sectionKey) {
  const cells = photos.map((p, i) => `
    <button type="button" class="media-thumb" data-section="${sectionKey}" data-index="${i}"
      style="background-image:url('${escapeHtml(mediaUrl(p))}')" aria-label="${escapeHtml(title)} ${i + 1}"></button>
  `).join("");
  return `
    <div class="media-section">
      <h3 class="media-section-title">${escapeHtml(title)}</h3>
      <div class="media-grid">${cells}</div>
    </div>
  `;
}

export async function renderBookingMedia({ code }) {
  setTitle(t("media.title"));
  const backToDetails = () => navigate(`#/client/bookings/${code}/details`);
  showBack(backToDetails);
  setBottomNav([]);

  const app = document.getElementById("app");
  app.innerHTML = `<p>${t("common.loading")}</p>`;

  if (!api.hasToken()) {
    app.innerHTML = `<p class="muted">${t("my.need_auth")} <a href="#/client/login">${t("my.dev_login")}</a></p>`;
    return;
  }

  let data;
  try {
    data = await api.getBookingMedia(code);
  } catch (e) {
    app.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    return;
  }

  const sections = [];
  if (data.hotel_photos?.length) {
    sections.push({ key: "hotel", title: t("media.section_hotel"), photos: data.hotel_photos });
  }
  if (data.room_photos?.length) {
    sections.push({ key: "room", title: t("media.section_room"), photos: data.room_photos });
  }

  if (!sections.length) {
    app.innerHTML = `<p class="muted">${t("media.empty")}</p>`;
    return;
  }

  app.innerHTML = sections.map((s) => sectionHtml(s.title, s.photos, s.key)).join("");

  app.querySelectorAll(".media-thumb").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.section;
      const i = Number(btn.dataset.index);
      const sec = sections.find((s) => s.key === key);
      if (!sec) return;
      // Пока lightbox открыт — TG Back закрывает фото (а не уводит с
      // view). После закрытия восстанавливаем back на /details.
      const close = openLightbox(sec.photos, i, {
        onAfterClose: () => showBack(backToDetails),
      });
      showBack(() => close());
    });
  });
}
