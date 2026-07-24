// TBB-31: двухфазная форма запроса на отмену подтверждённого бронирования.
// Не отменяет бронь фактически — отправляет системку в чат брони, партнёр
// обрабатывает вручную.
//
// State-based (phase1 form / phase2 sent / already-notified): TG-Back из
// любого состояния → /client/bookings. Открывается через replaceState в
// caller'е (booking_details.js), поэтому обычный TG-Back снимает форму
// без промежуточного details.

import { api } from "../../api.js";
import { t, getLang } from "../../i18n.js";
import { navigate } from "../../router.js";
import { setTitle, showBack } from "../../topbar.js";
import { setBottomNav } from "../../bottomnav.js";
import { escapeHtml } from "./bookings_card.js";
import { openChatWithHotel } from "./chat/open.js";

const REASONS = [
  "plans_changed",
  "found_better",
  "booking_error",
  "partner_issue",
  "other",
];

function backToBookings() {
  navigate("#/client/bookings");
}

function formatWhen(iso) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(getLang(), {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

function reasonsFromForm(app) {
  return REASONS.filter(
    (code) => app.querySelector(`input[name="reason"][value="${code}"]`)?.checked,
  );
}

function noteFromForm(app) {
  const raw = app.querySelector("textarea[name='note']")?.value || "";
  return raw.trim();
}

function renderPhase1(app, booking) {
  app.innerHTML = `
    <div class="cancel-form">
      <h2>${escapeHtml(t("cancel_req.h1"))}</h2>
      <div class="cancel-reasons">
        ${REASONS.map(
          (code) => `
          <label class="cancel-reason">
            <input type="checkbox" name="reason" value="${code}" />
            <span>${escapeHtml(t("cancel_req.reason." + code))}</span>
          </label>`,
        ).join("")}
      </div>
      <label class="cancel-note">
        <span class="cancel-note-label">${escapeHtml(t("cancel_req.note_label"))}</span>
        <textarea name="note" rows="3" placeholder="${escapeHtml(t("cancel_req.note_placeholder"))}" maxlength="2000"></textarea>
      </label>
      <div class="error" id="cancel-error" hidden></div>
      <div class="cancel-actions">
        <button type="button" class="secondary" id="cancel-back">${escapeHtml(t("cancel_req.btn.back"))}</button>
        <button type="button" class="primary" id="cancel-submit">${escapeHtml(t("cancel_req.btn.confirm"))}</button>
      </div>
    </div>`;

  const errBox = app.querySelector("#cancel-error");
  const submitBtn = app.querySelector("#cancel-submit");
  const showError = (msg) => {
    errBox.textContent = msg;
    errBox.hidden = false;
  };
  const clearError = () => {
    errBox.hidden = true;
    errBox.textContent = "";
  };
  app.querySelectorAll("input[name='reason'], textarea[name='note']").forEach(
    (el) => el.addEventListener("input", clearError),
  );

  app.querySelector("#cancel-back").onclick = backToBookings;

  submitBtn.onclick = async () => {
    const reasons = reasonsFromForm(app);
    const note = noteFromForm(app);
    if (reasons.length === 0) {
      showError(t("cancel_req.min_reasons"));
      return;
    }
    if (reasons.includes("other") && !note) {
      showError(t("cancel_req.note_required_for_other"));
      return;
    }
    submitBtn.disabled = true;
    try {
      await api.requestCancellation(booking.code, reasons, note);
      renderPhase2(app, booking);
    } catch (e) {
      if (e.status === 409 && e.code === "cancellation_already_requested") {
        renderAlreadyNotified(app, booking, e.detail?.requested_at);
      } else {
        submitBtn.disabled = false;
        showError(e.message);
      }
    }
  };
}

function renderPhase2(app, booking) {
  app.innerHTML = `
    <div class="cancel-form">
      <h2>${escapeHtml(t("cancel_req.sent.title"))}</h2>
      <p>${escapeHtml(t("cancel_req.sent.body", { hotel: booking.hotel_name_ru }))}</p>
      <button type="button" class="primary" id="cancel-done">${escapeHtml(t("cancel_req.sent.close"))}</button>
    </div>`;
  app.querySelector("#cancel-done").onclick = backToBookings;
}

function renderAlreadyNotified(app, booking, requestedAt) {
  const when = requestedAt ? formatWhen(requestedAt) : "";
  app.innerHTML = `
    <div class="cancel-form">
      <h2>${escapeHtml(t("cancel_req.already.title"))}</h2>
      <p>${escapeHtml(t("cancel_req.already.body", { when }))}</p>
      <div class="cancel-actions">
        <button type="button" class="secondary" id="cancel-back">${escapeHtml(t("cancel_req.btn.back"))}</button>
        <button type="button" class="primary" id="open-chat">${escapeHtml(t("cancel_req.already.open_chat"))}</button>
      </div>
    </div>`;
  app.querySelector("#cancel-back").onclick = backToBookings;
  app.querySelector("#open-chat").onclick = () =>
    openChatWithHotel(booking.hotel_id, {
      type: "booking",
      id: booking.id,
      name: t("my.code", { code: booking.code }),
      extra: t("my.dates", { ci: booking.check_in, co: booking.check_out }),
    });
}

export async function renderCancelRequest({ code }) {
  setTitle(t("cancel_req.title"));
  showBack(backToBookings);
  setBottomNav([]);

  const app = document.getElementById("app");
  app.innerHTML = `<p>${t("common.loading")}</p>`;

  if (!api.hasToken()) {
    app.innerHTML = `<p class="muted">${t("my.need_auth")} <a href="#/client/login">${t("my.dev_login")}</a></p>`;
    return;
  }

  let booking;
  try {
    booking = await api.getBooking(code);
  } catch (e) {
    app.innerHTML = `<div class="error">${t("common.error", { msg: e.message })}</div>`;
    return;
  }

  // Guard: только confirmed + не отменённая. Для draft/pending_payment
  // существует immediate cancel через my.cancel_booking (см. pay.js).
  const ineligible =
    !booking.confirmed
    || booking.status === "cancelled"
    || booking.status === "refunded";
  if (ineligible) {
    navigate(`#/client/bookings/${encodeURIComponent(code)}/details`);
    return;
  }

  renderPhase1(app, booking);
}
