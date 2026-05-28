import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { navigate } from "../../router.js";
import { setTitle, showBack } from "../../topbar.js";
import { setBottomNav } from "../../bottomnav.js";
import { clientNavItems } from "../nav.js";

const ICON_WRITE_SM = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px;margin-right:6px"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;

function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function statusText(b) {
  if (b.status === "pending") {
    return b.confirmed
      ? t("my.status.pending_confirmed")
      : t("my.status.pending_unconfirmed");
  }
  return t("my.status." + b.status);
}

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

  app.innerHTML = items
    .map((b) => {
      const hotelLine = b.hotel_name_ru
        ? `<div>${escapeHtml(b.hotel_name_ru)}</div>`
        : "";
      const payBtn =
        b.status === "pending" && !b.postpay
          ? `<a class="primary" href="#/client/pay/${b.code}">${t("my.pay")}</a>`
          : "";
      const writeBtn = `<button class="secondary" type="button" data-write-bk="${b.code}">${ICON_WRITE_SM}${t("my.write")}</button>`;
      const actions = `<div class="bk-actions" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">${payBtn}${writeBtn}</div>`;
      return `
        <div class="card">
          <div class="meta">${t("my.code", { code: b.code })}</div>
          ${hotelLine}
          <div>${t("my.dates", { ci: b.check_in, co: b.check_out })} · ${t("my.guests", { n: b.guests })}</div>
          <div class="price">${t("my.total", { total: b.total_kgs })}</div>
          <div class="meta">${statusText(b)}</div>
          ${actions}
        </div>`;
    })
    .join("");

  app.querySelectorAll("button[data-write-bk]").forEach((btn) => {
    btn.addEventListener("click", () => alert(t("chat.coming_soon")));
  });
}
