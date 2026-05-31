import { api } from "../../api.js";
import { t, tn } from "../../i18n.js";
import { navigate, getQuery } from "../../router.js";
import { setTitle, showBack } from "../../topbar.js";
import { setBottomNav } from "../../bottomnav.js";
import { inTelegram, tg } from "../../tg.js";

// Куда back из /pay. Источник передаётся через ?from в hash-query, потому что
// history.back() в TG WebView нестабилен (закрывает WebApp).
function backTargetFor(booking, from) {
  if (from === "bookings") return "#/client/bookings";
  if (from === "booking_details") return `#/client/bookings/${booking.code}/details`;
  return `#/client/hotel/${booking.hotel_id}`;
}

export async function renderPay({ code }) {
  const app = document.getElementById("app");
  const q = getQuery();
  const from = q.from || null;
  setTitle(t("pay.title", { code }));
  setBottomNav([]);
  // Дефолтный back — в hub. После загрузки booking переопределим на источник.
  showBack(() => navigate("#/"));

  if (!api.hasToken() && inTelegram) {
    try {
      const r = await api.authTg(tg.initData);
      api.setSession(r.token, r.user);
    } catch (e) {
      app.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
      return;
    }
  }
  if (!api.hasToken()) {
    app.innerHTML = `<p class="muted">${t("my.need_auth")}<a href="#/client/login">${t("my.dev_login")}</a></p>`;
    return;
  }

  app.innerHTML = `<p>${t("common.loading")}</p>`;
  let booking;
  try {
    booking = await api.getBooking(code);
  } catch (e) {
    app.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    return;
  }
  // Booking загружен — back ведёт на источник, переданный в ?from.
  const backTarget = backTargetFor(booking, from);
  showBack(() => navigate(backTarget));

  if (booking.status === "paid") {
    app.innerHTML = `
      <div class="card">
        <div class="success">${t("pay.already_paid")}</div>
        <div class="meta">${t("my.code", { code })}</div>
        <div class="meta">${t("my.dates", { ci: booking.check_in, co: booking.check_out })} · ${tn("my.guests", booking.guests)}</div>
        <div class="price">${t("my.total", { total: booking.total_kgs })}</div>
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
          <a class="primary" href="#/client/hotel/${booking.hotel_id}">${t("pay.back_to_hotel")}</a>
          <button class="danger" id="cancel-booking-btn" type="button">${t("my.cancel_booking")}</button>
        </div>
        <div id="cancel-err" class="error"></div>
      </div>`;
    document.getElementById("cancel-booking-btn").onclick = async () => {
      if (!confirm(t("my.cancel_confirm"))) return;
      const btn = document.getElementById("cancel-booking-btn");
      const err = document.getElementById("cancel-err");
      btn.disabled = true;
      err.textContent = "";
      try {
        await api.cancelMyBooking(code);
        navigate("#/client/bookings");
      } catch (e) {
        err.textContent = t("common.error", { msg: e.message });
        btn.disabled = false;
      }
    };
    return;
  }
  if (booking.status !== "pending") {
    app.innerHTML = `<div class="error">${t("pay.bad_status", { status: t("my.status." + booking.status) })}</div>`;
    return;
  }
  if (booking.postpay) {
    app.innerHTML = `
      <div class="card pay-card">
        <div class="meta">${t("pay.for_booking", { code: booking.code })}</div>
        <div class="meta">${t("my.dates", { ci: booking.check_in, co: booking.check_out })} · ${tn("my.guests", booking.guests)}</div>
        <div class="price pay-amount">${t("pay.amount", { total: booking.total_kgs })}</div>
        <div class="success">${t("pay.postpay_note")}</div>
        <div style="margin-top:12px"><a class="primary" href="#/client/hotel/${booking.hotel_id}">${t("pay.back_to_hotel")}</a></div>
      </div>`;
    return;
  }

  let initData;
  try {
    initData = await api.payInit(code);
  } catch (e) {
    app.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    return;
  }

  const methodsHtml = initData.methods.map((m, i) => `
    <label class="pay-method">
      <input type="radio" name="pay-method" value="${m.key}" ${i === 0 ? "checked" : ""} />
      <span>${t(m.label_key)}</span>
    </label>
  `).join("");

  app.innerHTML = `
    <div class="card pay-card">
      <div class="meta">${t("pay.for_booking", { code: booking.code })}</div>
      <div class="meta">${t("my.dates", { ci: booking.check_in, co: booking.check_out })} · ${tn("my.guests", booking.guests)}</div>
      <div class="price pay-amount">${t("pay.amount", { total: initData.amount_kgs })}</div>
      <div class="pay-methods">${methodsHtml}</div>
      <button id="pay-submit" class="primary pay-submit">${t("pay.submit")}</button>
      <div id="pay-err" class="error"></div>
    </div>`;

  document.getElementById("pay-submit").onclick = async () => {
    const btn = document.getElementById("pay-submit");
    const err = document.getElementById("pay-err");
    btn.disabled = true;
    err.textContent = "";
    try {
      const res = await api.payConfirm(initData.payment_id);
      if (res.booking_status === "paid") {
        navigate(`#/client/pay/${code}`);  // re-render — попадёт в already_paid ветку
      } else {
        err.textContent = t("pay.unexpected_status", { status: res.booking_status });
        btn.disabled = false;
      }
    } catch (e) {
      err.textContent = t("common.error", { msg: e.message });
      btn.disabled = false;
    }
  };
}
