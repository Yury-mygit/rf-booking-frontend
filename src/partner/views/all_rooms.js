import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { escapeHtml } from "../../util.js";

const COLS = ["hotel", "room", "status"];

let _rows = [];
let _filters = { hotel: "", room: "", status: "" };

export async function renderAllRooms() {
  const app = document.getElementById("app");
  app.innerHTML = `<div id="list">${t("app.loading")}</div>`;
  try {
    _rows = await api.listAllRooms();
    renderTable();
  } catch (e) {
    document.getElementById("list").innerHTML =
      `<div class="error">${t("app.error", { msg: e.message })}</div>`;
  }
}

function renderTable() {
  const list = document.getElementById("list");
  if (!_rows.length) {
    list.innerHTML = `<p class="muted">${t("rooms.empty")}</p>`;
    return;
  }
  list.innerHTML = `
    <table class="rooms-table">
      <thead>
        <tr>
          <th>${t("rooms.col_hotel")}</th>
          <th>${t("rooms.col_room")}</th>
          <th>${t("rooms.col_status")}</th>
          <th>${t("rooms.col_calendar")}</th>
        </tr>
        <tr class="filter-row">
          <th><input type="text" data-col="hotel" value="${escapeHtml(_filters.hotel)}" placeholder="${t("filter.placeholder")}"></th>
          <th><input type="text" data-col="room" value="${escapeHtml(_filters.room)}" placeholder="${t("filter.placeholder")}"></th>
          <th><input type="text" data-col="status" value="${escapeHtml(_filters.status)}" placeholder="${t("filter.placeholder")}"></th>
          <th><button class="link-btn" id="filter-clear" title="${t("filter.clear")}">✕</button></th>
        </tr>
      </thead>
      <tbody id="rows-tbody"></tbody>
    </table>
    <div id="ctx-menu-mount"></div>
  `;

  list.querySelectorAll(".filter-row input").forEach((inp) => {
    inp.addEventListener("input", () => {
      _filters[inp.dataset.col] = inp.value;
      renderRows();
    });
  });
  document.getElementById("filter-clear").onclick = () => {
    for (const k of COLS) _filters[k] = "";
    renderTable();
  };

  renderRows();
}

function renderRows() {
  const tbody = document.getElementById("rows-tbody");
  const matched = _rows.filter(matchesFilters);
  if (!matched.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="muted" style="text-align:center;padding:14px">${t("filter.no_matches")}</td></tr>`;
    return;
  }
  tbody.innerHTML = matched.map(rowHtml).join("");
  tbody.querySelectorAll("td[data-col]").forEach(attachContextHandlers);
}

function cellValue(r, col) {
  if (col === "hotel") return r.hotel_name_ru;
  if (col === "room") return r.room_name_ru;
  if (col === "status") return t("rooms.today." + r.today_status);
  return "";
}

function rowHtml(r) {
  const statusLabel = t("rooms.today." + r.today_status);
  return `
    <tr>
      <td data-col="hotel">${escapeHtml(r.hotel_name_ru)}</td>
      <td data-col="room">${escapeHtml(r.room_name_ru)}<div class="muted small">${r.price_kgs} KGS · cap=${r.capacity}</div></td>
      <td data-col="status"><span class="today-pill ${r.today_status}">${escapeHtml(statusLabel)}</span></td>
      <td><a class="hotel-edit-btn" href="#/partner/room/${r.hotel_id}/${r.room_id}/availability" title="${t("rooms.col_calendar")}" aria-label="${t("rooms.col_calendar")}">📅</a></td>
    </tr>`;
}

function parseTokens(raw) {
  const positives = [];
  const negatives = [];
  for (const t0 of raw.split(",")) {
    const tok = t0.trim();
    if (!tok) continue;
    if (tok.startsWith("!")) {
      const v = tok.slice(1).trim();
      if (v) negatives.push(v.toLowerCase());
    } else {
      positives.push(tok.toLowerCase());
    }
  }
  return { positives, negatives };
}

function colMatches(value, raw) {
  if (!raw.trim()) return true;
  const lc = String(value || "").toLowerCase();
  const { positives, negatives } = parseTokens(raw);
  if (positives.length && !positives.some((p) => lc.includes(p))) return false;
  if (negatives.length && negatives.some((n) => lc.includes(n))) return false;
  return true;
}

function matchesFilters(r) {
  return COLS.every((c) => colMatches(cellValue(r, c), _filters[c]));
}

function attachContextHandlers(td) {
  td.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, td);
  });

  let timer = null;
  let startX = 0, startY = 0;
  td.addEventListener("touchstart", (e) => {
    const t0 = e.touches[0];
    startX = t0.clientX;
    startY = t0.clientY;
    timer = setTimeout(() => {
      timer = null;
      showContextMenu(t0.clientX, t0.clientY, td);
    }, 500);
  }, { passive: true });
  const cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
  };
  td.addEventListener("touchend", cancel);
  td.addEventListener("touchcancel", cancel);
  td.addEventListener("touchmove", (e) => {
    if (!timer) return;
    const t0 = e.touches[0];
    if (Math.abs(t0.clientX - startX) > 10 || Math.abs(t0.clientY - startY) > 10) {
      clearTimeout(timer);
      timer = null;
    }
  }, { passive: true });
}

function showContextMenu(x, y, td) {
  const col = td.dataset.col;
  const value = (td.textContent || "").trim().split("\n")[0].trim();
  if (!value) return;

  const mount = document.getElementById("ctx-menu-mount");
  const vw = window.innerWidth, vh = window.innerHeight;
  const left = Math.min(x, vw - 220);
  const top = Math.min(y, vh - 100);
  mount.innerHTML = `
    <div class="ctx-menu-backdrop" id="ctx-backdrop"></div>
    <div class="ctx-menu" style="left:${left}px;top:${top}px">
      <div class="ctx-menu-title">${escapeHtml(value)}</div>
      <button data-op="eq">${t("filter.ctx.eq")}</button>
      <button data-op="neq">${t("filter.ctx.neq")}</button>
    </div>
  `;
  document.getElementById("ctx-backdrop").onclick = closeContextMenu;
  mount.querySelectorAll("button[data-op]").forEach((btn) => {
    btn.onclick = () => {
      const op = btn.dataset.op;
      addTokenToFilter(col, value, op === "neq");
      closeContextMenu();
    };
  });
}

function closeContextMenu() {
  const mount = document.getElementById("ctx-menu-mount");
  if (mount) mount.innerHTML = "";
}

function addTokenToFilter(col, value, isNot) {
  const token = (isNot ? "!" : "") + value;
  const cur = _filters[col].trim();
  _filters[col] = cur ? `${cur}, ${token}` : token;
  renderTable();
}
