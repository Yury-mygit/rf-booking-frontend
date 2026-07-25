import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { setTitle } from "../../topbar.js";
import { todayPlus } from "../../util.js";

const DAYS_AHEAD = 28;

export async function renderAvailability({ hotelId, roomId }) {
  const app = document.getElementById("app");
  app.innerHTML = t("app.loading");

  let room;
  let rows;
  const from = todayPlus(0);
  const to = todayPlus(DAYS_AHEAD);
  try {
    room = await api.getRoom(hotelId, roomId);
    rows = await api.getAvailability(hotelId, roomId, from, to);
  } catch (e) {
    app.innerHTML = `<div class="error">${t("app.error", { msg: e.message })}</div>`;
    return;
  }

  const byDate = Object.fromEntries(rows.map((r) => [r.date, r]));

  setTitle(`${t("pageTitle.availability")} / ${t("avail.title", { room: room.name_ru })}`);
  app.innerHTML = `
    <div class="muted">Цена по умолчанию: ${room.price_kgs} сом/ночь</div>
    <div class="cal-legend">
      <span><i style="background:var(--cal-free)"></i>${t("avail.legend.free")}</span>
      <span><i style="background:var(--cal-blocked)"></i>${t("avail.legend.blocked")}</span>
      <span><i style="background:var(--cal-booked)"></i>${t("avail.legend.booked")}</span>
      <span><i style="background:var(--cal-free);border:2px solid var(--accent)"></i>${t("avail.legend.priced")}</span>
    </div>
    <div class="cal-grid" id="cal"></div>
    <div id="modal-mount"></div>
  `;

  const canManage = api.canDo("manage_bookings", api.activeOwnerId());
  const cal = document.getElementById("cal");
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = todayPlus(i);
    const row = byDate[d];
    const status = row ? row.status : "free";
    const priced = row && row.price_override != null;
    const cell = document.createElement("div");
    cell.className = `cal-cell ${status} ${priced ? "priced" : ""}`;
    const dt = new Date(d);
    cell.innerHTML = `<div class="day">${dt.getDate()}.${String(dt.getMonth() + 1).padStart(2, "0")}</div>
      ${priced ? `<div class="price">${row.price_override}</div>` : ""}`;
    if (status === "booked") {
      cell.title = "booked — нельзя редактировать";
    } else if (canManage) {
      cell.onclick = () => openEditor(d, row, room, hotelId, roomId);
    }
    cal.appendChild(cell);
  }
}

function openEditor(date, row, room, hotelId, roomId) {
  const mount = document.getElementById("modal-mount");
  const isBlocked = (row?.status || "free") === "blocked";
  const price = row?.price_override ?? "";
  mount.innerHTML = `
    <div class="modal-bg">
      <div class="modal">
        <h2>${t("avail.edit_title", { date })}</h2>
        <div class="form-row">
          <label style="display:flex;align-items:center;gap:8px">
            <input type="checkbox" id="m-blocked" ${isBlocked ? "checked" : ""}>
            ${t("avail.status.blocked")}
          </label>
        </div>
        <div class="form-row">
          <label>${t("avail.price_override")}</label>
          <input id="m-price" type="number" min="0" value="${price}" placeholder="${room.price_kgs}" />
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="secondary" id="m-cancel">${t("app.cancel")}</button>
          <button class="primary" id="m-save">${t("app.save")}</button>
        </div>
        <div id="m-err" class="error"></div>
      </div>
    </div>
  `;
  document.getElementById("m-cancel").onclick = () => (mount.innerHTML = "");
  document.getElementById("m-save").onclick = async () => {
    const blocked = document.getElementById("m-blocked").checked;
    const pRaw = document.getElementById("m-price").value;
    const p = pRaw === "" ? null : Number(pRaw);
    const status = blocked ? "blocked" : "free";
    try {
      await api.updateAvailability(hotelId, roomId, [
        { date, status, price_override: p },
      ]);
      mount.innerHTML = "";
      renderAvailability({ hotelId, roomId });
    } catch (e) {
      document.getElementById("m-err").textContent = t("app.error", { msg: e.message });
    }
  };
}
