import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { navigate } from "../../router.js";
import { setTitle } from "../../topbar.js";
import { escapeHtml, relativeTime } from "../../util.js";
import { setBottomNav } from "../nav.js";

const SVG_ATTR = 'viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const TAB_ICONS = {
  status: `<svg ${SVG_ATTR}><path d="M3 3v18h18"></path><rect x="7" y="13" width="3" height="5"></rect><rect x="12" y="9" width="3" height="9"></rect><rect x="17" y="5" width="3" height="13"></rect></svg>`,
  share: `<svg ${SVG_ATTR}><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"></path></svg>`,
  description: `<svg ${SVG_ATTR}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h8M8 17h6M8 9h2"></path></svg>`,
  photos: `<svg ${SVG_ATTR}><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`,
};

const FIELDS = [
  ["name_ru", "hotel.name_ru", "input"],
  ["name_ky", "hotel.name_ky", "input"],
  ["name_en", "hotel.name_en", "input"],
  ["description_ru", "hotel.description_ru", "textarea"],
  ["description_ky", "hotel.description_ky", "textarea"],
  ["description_en", "hotel.description_en", "textarea"],
  ["city", "hotel.city", "input"],
  ["address", "hotel.address", "input"],
  ["lat", "hotel.lat", "input-number"],
  ["lng", "hotel.lng", "input-number"],
];

const TABS = ["status", "share", "description", "photos"];

let _state = { hotel: null, rooms: [], active: "status" };

function setHotelTabsNav(id) {
  setBottomNav(
    TABS.map((name) => ({
      key: name,
      label: t("edit.section." + name),
      icon: TAB_ICONS[name],
      active: name === _state.active,
      onClick: () => switchTab(name, id),
    })),
  );
}

function descriptionFormHtml(hotel, canEdit = true) {
  const ro = canEdit ? "" : "readonly";
  return `
    <form id="form">
      ${FIELDS.map(([k, key, kind]) => {
        const v = hotel?.[k] ?? "";
        if (kind === "textarea") {
          return `<div class="form-row"><label>${t(key)}</label>
            <textarea name="${k}" ${ro}>${escapeHtml(v)}</textarea></div>`;
        }
        const inputType = kind === "input-number" ? "number" : "text";
        const step = kind === "input-number" ? 'step="any"' : "";
        return `<div class="form-row"><label>${t(key)}</label>
          <input type="${inputType}" ${step} name="${k}" value="${escapeHtml(v)}" ${ro} /></div>`;
      }).join("")}
      <div class="form-row"><label>${t("hotel.photos_urls")}</label>
        <input name="photos" value="${escapeHtml((hotel?.photos || []).join(", "))}" ${ro} /></div>
      ${canEdit ? `<button class="primary full" id="btn-save">${t("app.save")}</button>` : ""}
      <div id="form-err" class="error"></div>
    </form>
  `;
}

export async function renderHotelEdit({ id }) {
  const isNew = id === "new";
  const app = document.getElementById("app");
  app.innerHTML = t("app.loading");

  if (isNew) {
    setTitle(`${t("pageTitle.hotelEdit")} / ${t("hotel.title.new")}`);
    app.innerHTML = descriptionFormHtml(null);
    wireSaveHandler(true, id);
    return;
  }

  try {
    _state.hotel = await api.getHotel(id);
  } catch (e) {
    app.innerHTML = `<div class="error">${t("app.error", { msg: e.message })}</div>`;
    return;
  }

  setTitle(`${t("pageTitle.hotelEdit")} / ${t("hotel.title.edit")}`);
  app.innerHTML = `<div id="tab-body"></div>`;
  setHotelTabsNav(id);
  switchTab(_state.active, id);
}

function switchTab(name, id) {
  _state.active = name;
  setHotelTabsNav(id);
  const body = document.getElementById("tab-body");
  if (name === "status") return renderStatusTab(body, id);
  if (name === "share") return renderShareTab(body);
  if (name === "description") return renderDescriptionTab(body, id);
  if (name === "photos") return renderPhotosTab(body, id);
}

async function renderStatusTab(body, id) {
  const h = _state.hotel;
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

    ${renderQuickActions(h)}

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
  wireQuickActions(body, id);
}

function renderQuickActions(h) {
  const publicUrl = `https://book.dev.raftforge.art/?hotel=${encodeURIComponent(h.slug)}`;
  return `
    <div class="quick-actions">
      <button class="qa" data-qa="share">${t("status.actions.share")}</button>
      <button class="qa" data-qa="rooms">${t("status.actions.rooms")}</button>
      <button class="qa" data-qa="bookings">${t("status.actions.bookings")}</button>
      <a class="qa" href="${publicUrl}" target="_blank" rel="noopener">${t("status.actions.preview")}</a>
    </div>
  `;
}

function wireQuickActions(body, hotelId) {
  body.querySelectorAll(".quick-actions [data-qa]").forEach((el) => {
    el.onclick = (e) => {
      const act = el.dataset.qa;
      if (act === "share") {
        e.preventDefault();
        switchTab("share", hotelId);
      } else if (act === "rooms") {
        e.preventDefault();
        navigate(`#/partner/hotel/${hotelId}/rooms`);
      } else if (act === "bookings") {
        e.preventDefault();
        navigate("#/partner/bookings");
      }
    };
  });
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
  const canManage = api.canDo("manage_bookings", _state.hotel?.owner_user_id);
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
  const hotelId = _state.hotel.id;
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

function renderShareTab(body) {
  const h = _state.hotel;
  body.innerHTML = `
    <div class="form-row">
      <label>${t("hotel.share.web")}</label>
      <input id="share-web" readonly value="https://book.dev.raftforge.art/?hotel=${h.slug}" />
    </div>
    <div class="form-row">
      <label>${t("hotel.share.tg_start")}</label>
      <input id="share-tg-start" readonly value="https://t.me/rforge_stay_bot?start=hotel_${h.slug}" />
    </div>
    <div class="form-row">
      <label>${t("hotel.share.tg_startapp")}</label>
      <input id="share-tg-app" readonly value="https://t.me/rforge_stay_bot?startapp=hotel_${h.slug}" />
    </div>
    <div class="row-actions">
      <button class="secondary" id="btn-copy-web">${t("hotel.share.copy_web")}</button>
      <button class="secondary" id="btn-copy-tg-start">${t("hotel.share.copy_tg_start")}</button>
      <button class="secondary" id="btn-copy-tg-app">${t("hotel.share.copy_tg_startapp")}</button>
    </div>
    <div id="copy-toast" class="success" style="display:none">${t("hotel.share.copied")}</div>
  `;
  const copyTo = (selector) => {
    const el = document.querySelector(selector);
    el.select();
    navigator.clipboard?.writeText(el.value).catch(() => document.execCommand("copy"));
    const toast = document.getElementById("copy-toast");
    toast.style.display = "block";
    setTimeout(() => (toast.style.display = "none"), 1500);
  };
  document.getElementById("btn-copy-web").onclick = () => copyTo("#share-web");
  document.getElementById("btn-copy-tg-start").onclick = () => copyTo("#share-tg-start");
  document.getElementById("btn-copy-tg-app").onclick = () => copyTo("#share-tg-app");
}

function renderDescriptionTab(body, id) {
  const canEdit = api.canDo("manage_hotel", _state.hotel?.owner_user_id);
  body.innerHTML = descriptionFormHtml(_state.hotel, canEdit);
  if (canEdit) wireSaveHandler(false, id);
}

function renderPhotosTab(body, id) {
  const photos = _state.hotel.photos || [];
  const canEdit = api.canDo("manage_hotel", _state.hotel?.owner_user_id);
  body.innerHTML = `
    <div id="photos-list">
      ${photos.length === 0
        ? `<p class="muted">${t("photos.empty")}</p>`
        : photos
            .map(
              (url, i) => `
              <div class="photo-row">
                <img class="photo-thumb" src="${escapeHtml(url)}" alt="" />
                <div class="photo-meta">
                  ${i === 0 ? `<span class="status-pill published">${t("photos.main")}</span>` : ""}
                  <div class="meta" style="word-break:break-all">${escapeHtml(url)}</div>
                </div>
                ${canEdit ? `<div class="photo-actions">
                  <button class="secondary" data-up="${i}" ${i === 0 ? "disabled" : ""}>${t("photos.up")}</button>
                  <button class="secondary" data-down="${i}" ${i === photos.length - 1 ? "disabled" : ""}>${t("photos.down")}</button>
                  <button class="danger" data-del="${escapeHtml(url)}">${t("photos.delete")}</button>
                </div>` : ""}
              </div>`,
            )
            .join("")}
    </div>
    ${canEdit ? `<div class="photo-upload">
      <label class="meta">${t("photos.allowed")}</label>
      <input type="file" id="photo-file" accept="image/jpeg,image/png,image/webp" />
      <button class="primary" id="photo-upload-btn" disabled>${t("photos.upload")}</button>
      <div id="photo-status" class="meta"></div>
    </div>` : ""}
  `;

  if (!canEdit) return;

  body.querySelectorAll("button[data-up]").forEach((b) => {
    b.onclick = () => moveAndSave(Number(b.dataset.up), -1, id);
  });
  body.querySelectorAll("button[data-down]").forEach((b) => {
    b.onclick = () => moveAndSave(Number(b.dataset.down), +1, id);
  });
  body.querySelectorAll("button[data-del]").forEach((b) => {
    b.onclick = () => deletePhoto(b.dataset.del, id);
  });

  const fileInput = document.getElementById("photo-file");
  const uploadBtn = document.getElementById("photo-upload-btn");
  fileInput.onchange = () => {
    uploadBtn.disabled = !fileInput.files || fileInput.files.length === 0;
  };
  uploadBtn.onclick = () => uploadPhoto(fileInput, id);
}

async function moveAndSave(index, delta, hotelId) {
  const photos = [...(_state.hotel.photos || [])];
  const j = index + delta;
  if (j < 0 || j >= photos.length) return;
  [photos[index], photos[j]] = [photos[j], photos[index]];
  try {
    const res = await api.reorderPhotos(hotelId, photos);
    _state.hotel.photos = res.photos;
    switchTab("photos", hotelId);
  } catch (e) {
    alert(e.message);
  }
}

async function deletePhoto(url, hotelId) {
  if (!confirm(t("photos.delete") + " ?")) return;
  try {
    await api.deletePhoto(hotelId, url);
    _state.hotel.photos = (_state.hotel.photos || []).filter((u) => u !== url);
    switchTab("photos", hotelId);
  } catch (e) {
    alert(e.message);
  }
}

async function uploadPhoto(fileInput, hotelId) {
  const f = fileInput.files && fileInput.files[0];
  if (!f) return;
  const statusEl = document.getElementById("photo-status");
  statusEl.textContent = t("photos.uploading");
  try {
    const res = await api.uploadPhoto(hotelId, f);
    _state.hotel.photos = res.photos;
    switchTab("photos", hotelId);
  } catch (e) {
    statusEl.innerHTML = `<span class="error">${escapeHtml(e.message)}</span>`;
  }
}

function wireSaveHandler(isNew, id) {
  document.getElementById("btn-save").onclick = async (e) => {
    e.preventDefault();
    const form = document.getElementById("form");
    const payload = {};
    for (const [k, , kind] of FIELDS) {
      const raw = form[k].value.trim();
      if (raw === "") {
        payload[k] = isNew ? undefined : null;
        continue;
      }
      payload[k] = kind === "input-number" ? Number(raw) : raw;
    }
    const photosRaw = form.photos.value.trim();
    payload.photos = photosRaw ? photosRaw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean) : [];
    for (const k of Object.keys(payload)) {
      if (payload[k] === undefined) delete payload[k];
    }
    try {
      if (isNew) {
        const created = await api.createHotel(payload);
        navigate("#/partner/hotel/" + created.id);
      } else {
        const updated = await api.updateHotel(id, payload);
        _state.hotel = updated;
        document.getElementById("form-err").innerHTML = `<span class="success">${t("avail.saved")}</span>`;
      }
    } catch (e) {
      document.getElementById("form-err").textContent = t("app.error", { msg: e.message });
    }
  };
}

async function statusChange(id, status) {
  try {
    const updated = await api.updateHotel(id, { status });
    _state.hotel = updated;
    switchTab("status", id);
  } catch (e) {
    alert(e.message);
  }
}
