// Status tab — dashboard отеля: header + quick-actions + stats-cards +
// checklist + recent bookings + danger-zone. Все секции собираются в
// одном innerHTML, потом wire'аются listeners.

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { navigate } from "../../../router.js";
import { escapeHtml, relativeTime } from "../../../util.js";

import { state, switchTab } from "./index.js";
// TBB-11 — quick-actions перенесены в sub-bottomnav (см. hotel_edit/index.js
// mountStatusSubnav). Здесь они больше не рендерятся в шапке status-tab.

export async function renderStatusTab(body, id) {
  const h = state.hotel;
  body.innerHTML = `<p class="muted">${t("app.loading")}</p>`;

  let dash, recent;
  try {
    [dash, recent] = await Promise.all([
      api.getHotelDashboard(id),
      api.listBookings(null, { hotelId: id, limit: 5 }),
    ]);
  } catch (e) {
    body.innerHTML = `<div class="error">${t("app.error", { msg: e.message })}</div>`;
    return;
  }

  const canPublish = dash.can_publish;
  const isPublished = h.status === "published";
  const isBlocked = h.status === "blocked";
  const canManageHotel = api.canDo("manage_hotel", h.owner_user_id);

  const subline = isBlocked
    ? ""
    : isPublished && h.published_at
      ? t("status.header.published_ago", { ago: relativeTime(h.published_at, t) })
      : !isPublished && !h.published_at
        ? t("status.header.never_published")
        : !isPublished && h.published_at
          ? t("status.header.last_published_ago", { ago: relativeTime(h.published_at, t) })
          : "";

  body.innerHTML = `
    <div class="status-header ${h.status}">
      <div class="status-header-main">
        <span class="status-pill ${h.status} big">${t("hotels.status." + h.status)}</span>
        <div class="status-header-text">
          <div class="status-header-title">${t("status.header.title." + h.status)}</div>
          ${subline ? `<div class="status-header-sub muted">${escapeHtml(subline)}</div>` : ""}
        </div>
      </div>
      <div class="status-header-actions">
        ${(!canManageHotel || isBlocked)
          ? ""
          : isPublished
            ? `<button class="secondary" id="btn-unpub">${t("hotel.unpublish")}</button>`
            : `<button class="primary" id="btn-pub" ${canPublish ? "" : "disabled"}>${t("hotel.publish")}</button>`}
      </div>
    </div>

    ${renderStatsCards(dash.stats)}

    <div class="status-checklist">
      <h3>${t("status.checklist.title")}</h3>
      <ul class="checklist">
        ${dash.checks.map(renderChecklistItem).join("")}
      </ul>
      ${!canPublish && !isPublished && !isBlocked
        ? `<p class="muted">${t("status.checklist.publish_blocked")}</p>`
        : ""}
    </div>

    <div class="recent-bookings" id="recent-bookings-wrap">
      ${renderRecentBookings(recent)}
    </div>

    ${canManageHotel
      ? `<div class="danger-zone">
          <h3>${t("status.danger.title")}</h3>
          <p class="muted">${t("status.danger.body")}</p>
          <button class="danger" id="btn-del">${t("app.delete")}</button>
        </div>`
      : ""}
  `;

  document.getElementById("btn-pub")?.addEventListener("click", () => statusChange(id, "published"));
  document.getElementById("btn-unpub")?.addEventListener("click", () => statusChange(id, "draft"));
  const btnDel = document.getElementById("btn-del");
  if (btnDel) {
    btnDel.onclick = async () => {
      if (!confirm(t("hotel.delete_confirm"))) return;
      try {
        await api.deleteHotel(id);
        navigate("#/partner/");
      } catch (e) {
        alert(e.message);
      }
    };
  }

  body.querySelectorAll(".check-action[data-tab]").forEach((a) => {
    a.onclick = (e) => {
      e.preventDefault();
      switchTab(a.dataset.tab, id);
    };
  });

  wireRecentBookingActions(body, id);
}

function renderRecentBookings(items) {
  if (!items || items.length === 0) {
    return `
      <h3>${t("status.recent.title")}</h3>
      <p class="muted">${t("status.recent.empty")}</p>
    `;
  }
  return `
    <h3>${t("status.recent.title")}</h3>
    <table class="recent-table">
      <thead>
        <tr>
          <th>${t("status.recent.col_code")}</th>
          <th>${t("status.recent.col_guest")}</th>
          <th>${t("status.recent.col_dates")}</th>
          <th>${t("status.recent.col_status")}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${items.map(renderRecentRow).join("")}
      </tbody>
    </table>
  `;
}

function renderRecentRow(b) {
  const canManage = api.canDo("manage_bookings", state.hotel?.owner_user_id);
  const actions = !canManage
    ? ""
    : b.status === "pending"
      ? `
        <button class="link" data-act="confirm" data-code="${b.code}">${t("bookings.confirm")}</button>
        <button class="link danger" data-act="cancel" data-code="${b.code}">${t("bookings.cancel")}</button>
      `
      : b.status === "paid"
        ? `<button class="link danger" data-act="cancel" data-code="${b.code}">${t("bookings.cancel")}</button>`
        : "";
  return `
    <tr>
      <td><code>${escapeHtml(b.code)}</code></td>
      <td>${escapeHtml(b.client_first_name || "—")}</td>
      <td>${b.check_in} → ${b.check_out}</td>
      <td><span class="status-pill ${b.status}">${t("bookings.status." + b.status)}</span></td>
      <td class="row-actions">${actions}</td>
    </tr>
  `;
}

function wireRecentBookingActions(body, hotelId) {
  body.querySelectorAll(".recent-table button[data-act]").forEach((btn) => {
    btn.onclick = async () => {
      const code = btn.dataset.code;
      const act = btn.dataset.act;
      if (act === "cancel" && !confirm(t("bookings.cancel_confirm", { code }))) return;
      btn.disabled = true;
      try {
        if (act === "confirm") await api.confirmBooking(code);
        else if (act === "cancel") await api.cancelBooking(code);
        await renderStatusTab(body, hotelId);
      } catch (e) {
        alert(e.message);
        btn.disabled = false;
      }
    };
  });
}

function renderStatsCards(s) {
  const lastBooking = s.last_booking_at
    ? relativeTime(s.last_booking_at, t)
    : t("status.stats.no_bookings");
  return `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${s.bookings_total}</div>
        <div class="stat-label">${t("status.stats.bookings_total")}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${s.bookings_active}</div>
        <div class="stat-label">${t("status.stats.bookings_active")}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${s.checkins_next_7d}</div>
        <div class="stat-label">${t("status.stats.checkins_7d")}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${formatKgs(s.revenue_kgs_30d)}</div>
        <div class="stat-label">${t("status.stats.revenue_30d")}</div>
      </div>
      <div class="stat-card stat-card-wide">
        <div class="stat-value-sm">${escapeHtml(lastBooking)}</div>
        <div class="stat-label">${t("status.stats.last_booking")}</div>
      </div>
    </div>
  `;
}

function formatKgs(n) {
  return new Intl.NumberFormat("ru-RU").format(n) + " KGS";
}

function renderChecklistItem(c) {
  const icon = c.ok ? "✓" : c.kind === "required" ? "✕" : "⚠";
  const cls = c.ok ? "ok" : c.kind === "required" ? "fail-required" : "fail-recommended";
  const label = t(c.key, c.params || {});
  const hotelId = state.hotel.id;
  let action = "";
  if (!c.ok && c.action) {
    const fixLabel = t("status.check.fix");
    if (c.action.tab) {
      action = `<a href="#" class="check-action" data-tab="${c.action.tab}">${fixLabel}</a>`;
    } else if (c.action.room_id) {
      action = `<a href="#/partner/room/${hotelId}/${c.action.room_id}" class="check-action">${fixLabel}</a>`;
    } else if (c.action.nav === "rooms") {
      action = `<a href="#/partner/hotel/${hotelId}/rooms" class="check-action">${fixLabel}</a>`;
    }
  }
  return `
    <li class="check-item ${cls}">
      <span class="check-icon">${icon}</span>
      <span class="check-label">${escapeHtml(label)}</span>
      ${action}
    </li>`;
}

async function statusChange(id, status) {
  try {
    const updated = await api.updateHotel(id, { status });
    state.hotel = updated;
    switchTab("status", id);
  } catch (e) {
    alert(e.message);
  }
}
