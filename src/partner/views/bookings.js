// Partner bookings view — используется в двух режимах:
// A. Standalone `/partner/bookings` (renderBookings) — все брони по всем
//    отелям текущего owner'а, пишет в `#app`.
// B. Per-hotel subform `/partner/hotel/{id}/status/bookings`
//    (renderBookingsSubform) — брони одного отеля, пишет в переданный body
//    внутри hotel-hub shell'а. Nav / title поднимает `renderHotelHub`.
//
// SSE-подписки на изменения броней открыты, пока пользователь находится
// на любом из bookings-view; hashchange listener закрывает поток при
// уходе на другой раздел.

import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { escapeHtml } from "../../util.js";

let _eventSources = [];
let _refreshTimer = null;
// Если задан — list-запрос уходит с фильтром `hotel_id`; иначе брони
// показываются по всем отелям владельца.
let _hotelId = null;

function closeStreams() {
  _eventSources.forEach((es) => es.close());
  _eventSources = [];
  if (_refreshTimer) {
    clearTimeout(_refreshTimer);
    _refreshTimer = null;
  }
}

function scheduleReload() {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(() => {
    _refreshTimer = null;
    if (!document.getElementById("list")) return;
    load();
  }, 300);
}

async function openStreams() {
  closeStreams();
  let hotels;
  try {
    hotels = await api.listHotels();
  } catch {
    return;
  }
  hotels.forEach((h) => {
    const slug = h.slug || h.id;
    const es = new EventSource(`/api/v1/public/hotels/${encodeURIComponent(slug)}/events`);
    es.onmessage = scheduleReload;
    _eventSources.push(es);
  });
}

window.addEventListener("hashchange", () => {
  const hash = location.hash.replace(/^#/, "").split("?")[0];
  const isBookingsView =
    hash === "/partner/bookings"
    || /^\/partner\/hotel\/[^/]+\/status\/bookings$/.test(hash);
  if (!isBookingsView) closeStreams();
});

export async function renderBookings() {
  _hotelId = null;
  const app = document.getElementById("app");
  app.innerHTML = `<div id="list">${t("app.loading")}</div>`;
  await load();
  openStreams();
}

// Body-oriented режим: пишет только в body, без трогания #app. Используется
// renderHotelHub'ом для `.../status/bookings`.
export async function renderBookingsSubform(body, hotelId) {
  _hotelId = hotelId;
  body.innerHTML = `<div id="list">${t("app.loading")}</div>`;
  await load();
  openStreams();
}

async function load() {
  const list = document.getElementById("list");
  if (!list) return;
  list.innerHTML = t("app.loading");
  try {
    const items = await api.listBookings(null, _hotelId ? { hotelId: _hotelId } : {});
    if (!items.length) {
      list.innerHTML = `<p class="muted">${t("bookings.empty")}</p>`;
      return;
    }
    const ownerByHotel = new Map();
    try {
      const hotels = await api.listHotels();
      hotels.forEach((h) => ownerByHotel.set(h.id, h.owner_user_id));
    } catch (_) {}
    list.innerHTML = items
      .map((b) => {
        const ownerId = ownerByHotel.get(b.hotel_id);
        const canManage = api.canDo("manage_bookings", ownerId);
        const isPending = b.status === "pending";
        const isPaid = b.status === "paid";
        const canConfirm = canManage && isPending && !b.confirmed;
        const canMarkPaid = canManage && isPending && b.postpay;
        const canCancel = canManage && (isPending || isPaid);
        const canTogglePostpay = canManage && (isPending || isPaid);

        const confirmedPill = b.confirmed
          ? `<span class="status-pill confirmed">${t("bookings.pill.confirmed")}</span>`
          : `<span class="status-pill unconfirmed">${t("bookings.pill.unconfirmed")}</span>`;
        const paidPill = isPaid
          ? `<span class="status-pill paid">${t("bookings.pill.paid")}</span>`
          : (b.status === "cancelled" || b.status === "refunded"
              ? `<span class="status-pill ${b.status}">${t("bookings.status." + b.status)}</span>`
              : `<span class="status-pill unpaid">${t("bookings.pill.unpaid")}</span>`);
        const postpayPill = b.postpay
          ? `<span class="status-pill postpay">${t("bookings.pill.postpay")}</span>`
          : "";

        return `
          <div class="card">
            <h3>${escapeHtml(b.hotel_name_ru)} — ${escapeHtml(b.room_name_ru)}</h3>
            <div class="meta">${t("bookings.code", { code: b.code })}</div>
            <div class="meta">${t("bookings.dates", { ci: b.check_in, co: b.check_out, n: b.adults + b.children + b.infants })}</div>
            <div class="meta">${t("bookings.client", { name: escapeHtml(b.client_first_name || "—") })}</div>
            <div class="price">${t("bookings.total", { total: b.total_kgs })}</div>
            <div class="meta">${paidPill} ${confirmedPill} ${postpayPill}</div>
            ${canTogglePostpay ? `
              <label class="postpay-toggle">
                <input type="checkbox" data-postpay="${b.code}" ${b.postpay ? "checked" : ""} />
                <span>${t("bookings.postpay_label")}</span>
              </label>` : ""}
            ${canConfirm || canMarkPaid || canCancel ? `
              <div class="row-actions">
                ${canConfirm ? `<button class="primary" data-confirm="${b.code}">${t("bookings.confirm")}</button>` : ""}
                ${canMarkPaid ? `<button class="primary" data-markpaid="${b.code}">${t("bookings.mark_paid")}</button>` : ""}
                ${canCancel ? `<button class="danger" data-cancel="${b.code}">${t("bookings.cancel")}</button>` : ""}
              </div>` : ""}
          </div>`;
      })
      .join("");
    list.querySelectorAll("[data-confirm]").forEach((btn) => {
      btn.onclick = async () => {
        try { await api.confirmBooking(btn.dataset.confirm); await load(); }
        catch (e) { alert(e.message); }
      };
    });
    list.querySelectorAll("[data-markpaid]").forEach((btn) => {
      btn.onclick = async () => {
        try { await api.markPaid(btn.dataset.markpaid); await load(); }
        catch (e) { alert(e.message); }
      };
    });
    list.querySelectorAll("[data-cancel]").forEach((btn) => {
      btn.onclick = async () => {
        const code = btn.dataset.cancel;
        if (!confirm(t("bookings.cancel_confirm", { code }))) return;
        try { await api.cancelBooking(code); await load(); }
        catch (e) { alert(e.message); }
      };
    });
    list.querySelectorAll("[data-postpay]").forEach((cb) => {
      cb.onchange = async () => {
        const code = cb.dataset.postpay;
        const next = cb.checked;
        try { await api.setPostpay(code, next); await load(); }
        catch (e) { alert(e.message); cb.checked = !next; }
      };
    });
  } catch (e) {
    list.innerHTML = `<div class="error">${t("app.error", { msg: e.message })}</div>`;
  }
}
