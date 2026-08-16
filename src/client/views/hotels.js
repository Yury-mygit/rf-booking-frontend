import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { navigate } from "../../router.js";
import { setTitle, showBack } from "../../topbar.js";
import { setBottomNav } from "../../bottomnav.js";
import { clientNavItems } from "../nav.js";
import { PIN_SVG } from "./hotel/_shared.js";

function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function formatPriceKgs(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export async function renderHotels() {
  setTitle(t("client.nav.hotels"));
  showBack(() => navigate("#/"));
  setBottomNav(clientNavItems("hotels"));

  const app = document.getElementById("app");
  app.innerHTML = `<p>${t("common.loading")}</p>`;

  let items;
  try {
    items = await api.publicHotels();
  } catch (e) {
    app.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    return;
  }

  if (!items.length) {
    app.innerHTML = `<p class="muted">${t("hotels.empty")}</p>`;
    return;
  }

  app.innerHTML = items
    .map((h) => {
      const target = `#/client/hotel/${encodeURIComponent(h.slug || h.id)}`;
      const photo = (h.photos && h.photos[0]) || "";
      const photoStyle = photo
        ? `style="background-image:url('${escapeHtml(photo)}')"`
        : "";
      const addressText = [h.city, h.address].filter(Boolean).map(escapeHtml).join(" · ");
      const locLine = addressText
        ? `<p class="hcr-loc">${PIN_SVG}<span class="hcr-loc-text">${addressText}</span></p>`
        : "";
      const priceLine = h.min_price_kgs != null
        ? `<p class="hcr-price">${t("hotels.price_from", { amount: formatPriceKgs(h.min_price_kgs) })}</p>`
        : "";
      return `
        <a class="hotel-card-row" href="${target}">
          <div class="hcr-photo" ${photoStyle}></div>
          <div class="hcr-body">
            <h3>${escapeHtml(h.name_ru)}</h3>
            ${locLine}
            ${priceLine}
          </div>
        </a>`;
    })
    .join("");
}
