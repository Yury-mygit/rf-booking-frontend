import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { navigate } from "../../router.js";
import { setTitle, showBack } from "../../topbar.js";
import { inTelegram, tg } from "../../tg.js";

export async function renderPay({ code }) {
  const app = document.getElementById("app");
  setTitle(t("pay.title", { code }));
  // Дефолтный back — в hub. После загрузки booking переопределим на hotel.
  // history.back() в TG WebView ведёт себя нестабильно (закрывает WebApp).
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
  // Booking загружен — back ведёт обратно на отель, не в hub.
  showBack(() => navigate(`#/client/hotel/${booking.hotel_id}`));

  if (booking.status === "paid") {
    app.innerHTML = `
      <div class="card">
        <div class="success">${t("pay.already_paid")}</div>
        <div class="meta">${t("my.code", { code })}</div>
        <div class="meta">${t("my.dates", { ci: booking.check_in, co: booking.check_out })} · ${t("my.guests", { n: booking.guests })}</div>
        <div class="price">${t("my.total", { total: booking.total_kgs })}</div>
        <div style="margin-top:12px"><a class="primary" href="#/client/hotel/${booking.hotel_id}">${t("pay.back_to_hotel")}</a></div>
      </div>`;
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
        <div class="meta">${t("my.dates", { ci: booking.check_in, co: booking.check_out })} · ${t("my.guests", { n: booking.guests })}</div>
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
      <div class="meta">${t("my.dates", { ci: booking.check_in, co: booking.check_out })} · ${t("my.guests", { n: booking.guests })}</div>
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
