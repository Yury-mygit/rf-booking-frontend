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
      <div class="card pay-card">
        <button type="button" class="pay-close-btn" id="pay-cancel-x" aria-label="${t("cancel_req.action")}" title="${t("cancel_req.action")}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <div class="success">${t("pay.already_paid")}</div>
        <div class="meta">${t("my.code", { code })}</div>
        <div class="meta">${t("my.dates", { ci: booking.check_in, co: booking.check_out })} · ${tn("my.guests", booking.guests)}</div>
        <div class="price">${t("my.total", { total: booking.total_kgs })}</div>
      </div>`;
    document.getElementById("pay-cancel-x").onclick = () => {
      navigate(`#/client/bookings/${encodeURIComponent(code)}/cancel`);
    };
    return;
  }
  if (booking.status !== "pending") {
    app.innerHTML = `<div class="error">${t("pay.bad_status", { status: t("my.status." + booking.status) })}</div>`;
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
      <div id="qr-panel" class="qr-panel" hidden></div>
      <button id="pay-submit" class="primary pay-submit">${t("pay.submit")}</button>
      <div id="pay-err" class="error"></div>
    </div>`;

  const qrMethod = initData.methods.find((m) => m.key === "qr");
  const qrPanel = document.getElementById("qr-panel");
  const paySubmit = document.getElementById("pay-submit");

  function renderMode() {
    const sel = document.querySelector('input[name="pay-method"]:checked')?.value;
    if (sel === "qr" && qrMethod) {
      qrPanel.hidden = false;
      qrPanel.innerHTML = `
        <img class="qr-panel-img" src="${qrMethod.qr_image_url}" alt="${t("pay.method.qr")}" />
        <button type="button" class="primary" id="qr-pay-btn">${t("pay.qr.button")}</button>`;
      document.getElementById("qr-pay-btn").onclick = handleQrPay;
      paySubmit.hidden = true;
    } else {
      qrPanel.hidden = true;
      qrPanel.innerHTML = "";
      paySubmit.hidden = false;
    }
  }
  document.querySelectorAll('input[name="pay-method"]').forEach((r) =>
    r.addEventListener("change", renderMode),
  );
  renderMode();

  async function decodeQrUrl(imageUrl) {
    const { default: jsQR } = await import("jsqr");
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("image_load_failed"));
      img.src = imageUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imgData.data, imgData.width, imgData.height);
    if (!code || !code.data) return null;
    return code.data;
  }

  async function handleQrPay() {
    const btn = document.getElementById("qr-pay-btn");
    const err = document.getElementById("pay-err");
    err.textContent = "";
    btn.disabled = true;
    try {
      const payload = await decodeQrUrl(qrMethod.qr_image_url);
      if (!payload || !/^https?:\/\//i.test(payload)) {
        err.textContent = t("pay.qr.decode_failed");
        btn.disabled = false;
        return;
      }
      if (inTelegram && tg?.openLink) {
        tg.openLink(payload);
      } else {
        window.open(payload, "_blank", "noopener");
      }
      btn.disabled = false;
    } catch (e) {
      err.textContent = t("pay.qr.decode_failed");
      btn.disabled = false;
    }
  }

  paySubmit.onclick = async () => {
    const err = document.getElementById("pay-err");
    paySubmit.disabled = true;
    err.textContent = "";
    try {
      const res = await api.payConfirm(initData.payment_id);
      if (res.booking_status === "paid") {
        navigate(`#/client/pay/${code}`);  // re-render — попадёт в already_paid ветку
      } else {
        err.textContent = t("pay.unexpected_status", { status: res.booking_status });
        paySubmit.disabled = false;
      }
    } catch (e) {
      err.textContent = t("common.error", { msg: e.message });
      paySubmit.disabled = false;
    }
  };
}
