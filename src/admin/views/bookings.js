import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { escapeHtml } from "../../util.js";

export async function renderBookings() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="filter-row">
      <div>
        <label>${t("bookings.filter.status")}</label>
        <select id="f-st">
          <option value="">${t("bookings.filter.status_any")}</option>
          <option value="pending">${t("bookings.status.pending")}</option>
          <option value="paid">${t("bookings.status.paid")}</option>
          <option value="cancelled">${t("bookings.status.cancelled")}</option>
          <option value="refunded">${t("bookings.status.refunded")}</option>
        </select>
      </div>
    </div>
    <div id="list">${t("app.loading")}</div>`;
  document.getElementById("f-st").onchange = load;
  load();
}

async function load() {
  const st = document.getElementById("f-st").value;
  const list = document.getElementById("list");
  list.innerHTML = t("app.loading");
  try {
    const items = await api.adminListBookings({ status: st });
    if (!items.length) {
      list.innerHTML = `<p class="muted">${t("bookings.empty")}</p>`;
      return;
    }
    list.innerHTML = items
      .map(
        (b) => `
        <div class="card">
          <div><b>${escapeHtml(b.hotel_name_ru)}</b>
            <span class="status-pill ${b.status}">${t("bookings.status." + b.status)}</span></div>
          <div class="meta">${t("bookings.code", { code: b.code })}</div>
          <div class="meta">${t("bookings.dates", { ci: b.check_in, co: b.check_out, n: b.adults + b.children + b.infants })}</div>
          <div class="meta">uid=${b.client_id} · ${t("bookings.client", { name: escapeHtml(b.client_first_name || "—") })}</div>
          <div class="meta">${t("bookings.total", { total: b.total_kgs })}</div>
          ${b.status === "pending" || b.status === "paid"
            ? `<div class="row-actions"><button class="danger" data-cancel="${b.code}">${t("bookings.btn_cancel")}</button></div>`
            : ""}
        </div>`,
      )
      .join("");
    list.querySelectorAll("[data-cancel]").forEach((btn) => {
      btn.onclick = async () => {
        const code = btn.dataset.cancel;
        if (!confirm(t("bookings.cancel_confirm", { code }))) return;
        try {
          await api.adminCancelBooking(code);
          load();
        } catch (e) { alert(e.message); }
      };
    });
  } catch (e) {
    list.innerHTML = `<div class="error">${t("app.error", { msg: e.message })}</div>`;
  }
}
