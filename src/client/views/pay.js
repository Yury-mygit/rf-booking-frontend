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
      <div id="method-panel" class="pay-method-panel"></div>
      <div id="pay-err" class="error"></div>
    </div>`;

  const devpayMethod = initData.methods.find((m) => m.key === "devpay");
  const qrMethod = initData.methods.find((m) => m.key === "qr");
  const panel = document.getElementById("method-panel");
  const errBox = document.getElementById("pay-err");

  // Origin devpay из checkout_url — фильтр для postMessage.
  const devpayOrigin = devpayMethod ? new URL(devpayMethod.checkout_url).origin : null;

  let messageHandler = null;
  function detachListener() {
    if (messageHandler) {
      window.removeEventListener("message", messageHandler);
      messageHandler = null;
    }
  }

  async function retryDevpay() {
    errBox.textContent = "";
    try {
      const fresh = await api.payInit(code);
      const nextMethod = fresh.methods.find((m) => m.key === "devpay");
      if (!nextMethod) {
        navigate(`#/client/pay/${encodeURIComponent(code)}`);
        return;
      }
      devpayMethod.checkout_url = nextMethod.checkout_url;
      renderDevpay();
    } catch (e) {
      errBox.textContent = t("common.error", { msg: e.message });
    }
  }

  function showDevpayFailure(kind, reason) {
    detachListener();
    let msgKey = "pay.cancelled";
    if (kind === "declined") {
      msgKey = reason && `pay.declined_reason.${reason}`;
      if (!msgKey || !t(msgKey)) msgKey = "pay.declined_reason.user_declined";
    }
    panel.innerHTML = `
      <div class="devpay-failure">
        <div class="devpay-failure-msg">${t(msgKey)}</div>
        <button type="button" class="primary" id="devpay-retry">${t("pay.retry")}</button>
      </div>`;
    document.getElementById("devpay-retry").onclick = retryDevpay;
  }

  function renderDevpay() {
    panel.innerHTML = `
      <iframe id="devpay-frame"
        src="${devpayMethod.checkout_url}"
        class="devpay-iframe"
        allow="autoplay"></iframe>`;
    detachListener();
    messageHandler = (event) => {
      if (event.origin !== devpayOrigin) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.event === "devpay:paid") {
        detachListener();
        navigate(`#/client/pay/${encodeURIComponent(code)}`);
      } else if (data.event === "devpay:declined") {
        showDevpayFailure("declined", data.reason);
      } else if (data.event === "devpay:cancelled") {
        showDevpayFailure("cancelled", null);
      }
    };
    window.addEventListener("message", messageHandler);
  }

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
    errBox.textContent = "";
    btn.disabled = true;
    try {
      const payload = await decodeQrUrl(qrMethod.qr_image_url);
      if (!payload || !/^https?:\/\//i.test(payload)) {
        errBox.textContent = t("pay.qr.decode_failed");
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
      errBox.textContent = t("pay.qr.decode_failed");
      btn.disabled = false;
    }
  }

  function renderQr() {
    detachListener();
    panel.innerHTML = `
      <img class="qr-panel-img" src="${qrMethod.qr_image_url}" alt="${t("pay.method.qr")}" />
      <button type="button" class="primary" id="qr-pay-btn">${t("pay.qr.button")}</button>`;
    document.getElementById("qr-pay-btn").onclick = handleQrPay;
  }

  function renderMode() {
    const sel = document.querySelector('input[name="pay-method"]:checked')?.value;
    errBox.textContent = "";
    if (sel === "devpay" && devpayMethod) renderDevpay();
    else if (sel === "qr" && qrMethod) renderQr();
    else { detachListener(); panel.innerHTML = ""; }
  }

  document.querySelectorAll('input[name="pay-method"]').forEach((r) =>
    r.addEventListener("change", renderMode),
  );
  renderMode();
}
