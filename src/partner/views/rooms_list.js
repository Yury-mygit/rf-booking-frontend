// Rooms subform для hotel-hub (TBB-16, 2026-07-02 refactor).
// Раньше renderRoomsList писал в `#app` и сам поднимал hotel-hub bottomnav
// + subnav. Теперь это body-oriented subform: пишет только в переданный
// container, а nav / title / shell'ом управляет `renderHotelHub`
// (hotel_edit/index.js).

import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { assetThumbUrl, escapeHtml } from "../../util.js";
import { state } from "./hotel_edit/index.js";

export async function renderRoomsSubform(body, hotelId) {
  body.innerHTML = `<p class="muted">${t("app.loading")}</p>`;
  let rooms = [];
  try {
    rooms = await api.listRooms(hotelId);
  } catch (e) {
    body.innerHTML = `<div class="error">${t("app.error", { msg: e.message })}</div>`;
    return;
  }
  const hotel = state.hotel;
  const canManageRooms = api.canDo("manage_rooms", hotel?.owner_user_id);
  body.innerHTML = `
    <div id="rooms-list">
      ${rooms.length === 0
        ? `<p class="muted">— ${t("hotels.empty")} —</p>`
        : rooms.map((r) => roomCardHtml(r, hotelId)).join("")}
    </div>
    ${canManageRooms ? `<a href="#/partner/room/${hotelId}/new" class="secondary" style="display:inline-block;padding:8px 14px;text-decoration:none;border:1px solid var(--accent);border-radius:4px;color:var(--accent);background:var(--surface);margin-top:8px">${t("hotel.add_room")}</a>` : ""}
  `;
  attachCardHandlers(document.getElementById("rooms-list"));
}

function attachCardHandlers(container) {
  if (!container) return;
  container.addEventListener("click", (e) => {
    if (e.target.closest("a, button")) return;
    const card = e.target.closest(".clickable-card");
    if (!card) return;
    const href = card.dataset.href;
    if (href) location.hash = href;
  });
  container.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".clickable-card");
    if (!card) return;
    e.preventDefault();
    location.hash = card.dataset.href;
  });
}

function roomCardHtml(r, hotelId) {
  const photo = (r.photos && r.photos[0]) || "";
  const thumb = assetThumbUrl(photo);
  const photoHtml = thumb
    ? `<div class="hotel-thumb" style="background-image:url('${escapeHtml(thumb)}')"></div>`
    : `<div class="hotel-thumb hotel-thumb-empty"></div>`;
  return `
    <div class="card hotel-row clickable-card" data-href="#/partner/room/${hotelId}/${r.id}" role="link" tabindex="0">
      ${photoHtml}
      <div class="hotel-row-body">
        <h3>${escapeHtml(r.name_ru)}</h3>
        <div class="meta">capacity=${r.capacity}${r.beds != null ? `, ${t("room.beds")}: ${r.beds}` : ""}, ${r.price_kgs} сом/ночь${r.floor != null ? `, ${t("room.floor")}: ${r.floor}` : ""}</div>
      </div>
      <div class="hotel-actions">
        <a class="hotel-edit-btn" href="#/partner/room/${hotelId}/${r.id}/availability" title="${t("room.availability")}" aria-label="${t("room.availability")}">📅</a>
      </div>
    </div>`;
}
