import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { escapeHtml, todayPlus } from "../../util.js";

const DAYS_AHEAD = 28;
const DOC_KINDS = ["passport", "id_card", "driving_license", "other"];

export async function openWalkinModal({ hotelId, roomId, room, initialDate, onSuccess }) {
  if (!api.canDo("manage_bookings", api.activeOwnerId())) return;
  let mount = document.getElementById("modal-mount");
  if (!mount) {
    mount = document.createElement("div");
    mount.id = "modal-mount";
    document.getElementById("app").appendChild(mount);
  }

  const from = todayPlus(0);
  const to = todayPlus(DAYS_AHEAD);
  let avail = [];
  try {
    avail = await api.getAvailability(hotelId, roomId, from, to);
  } catch (e) {
    alert(e.message);
    return;
  }
  const dayState = {};
  for (const a of avail) {
    if (a.status === "blocked" || a.status === "booked") {
      dayState[a.date] = a.status;
    }
  }

  let checkIn = initialDate || todayPlus(0);
  let checkOut = null;

  mount.innerHTML = `
    <div class="modal-bg">
      <div class="modal wide">
        <h2>${t("walkin.title")}</h2>
        <div class="muted small">${escapeHtml(room.name_ru)} · ${room.price_kgs} KGS</div>
        <p class="muted small">${t("walkin.dates_hint")}</p>
        <div class="walkin-cal" id="wc"></div>
        <div class="muted small" id="wc-summary"></div>

        <form id="walkin-form" style="margin-top:10px">
          <label>${t("client.first_name")} *<input name="first_name" required></label>
          <label>${t("client.last_name")}<input name="last_name"></label>
          <label>${t("client.phone")}<input name="phone" inputmode="tel"></label>
          <label>${t("client.email")}<input name="email" type="email"></label>
          <label>${t("walkin.guests")}<input name="guests" type="number" min="1" max="${room.capacity}" value="1"></label>
          <label>${t("client.doc_kind")}
            <select name="doc_kind">
              <option value="">${t("client.doc_kind.none")}</option>
              ${DOC_KINDS.map(k => `<option value="${k}">${t("client.doc_kind." + k)}</option>`).join("")}
            </select>
          </label>
          <label>${t("client.doc_number")}<input name="doc_number"></label>
          <div id="lookup-hint" class="muted small" style="display:none">${t("walkin.lookup_hint")}</div>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button type="button" class="secondary" id="walkin-cancel">${t("walkin.cancel")}</button>
            <button type="submit" class="primary">${t("walkin.ok")}</button>
          </div>
          <div id="walkin-err" class="error"></div>
        </form>
      </div>
    </div>
  `;

  function renderCal() {
    const wc = document.getElementById("wc");
    wc.innerHTML = "";
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = todayPlus(i);
      const st = dayState[d];
      const dt = new Date(d);
      const cell = document.createElement("div");
      let cls = "wd";
      if (st) cls += " " + st;
      const inRange = checkOut
        ? (d >= checkIn && d < checkOut)
        : (d === checkIn);
      if (inRange) cls += " in-range";
      if (d === checkIn || (checkOut && d === addDays(checkOut, -1))) cls += " endpoint";
      cell.className = cls;
      cell.textContent = `${dt.getDate()}.${String(dt.getMonth() + 1).padStart(2, "0")}`;
      if (!st) cell.onclick = () => pickDay(d);
      wc.appendChild(cell);
    }
    const co = checkOut || addDays(checkIn, 1);
    document.getElementById("wc-summary").textContent =
      `${t("walkin.check_in")}: ${checkIn} · ${t("walkin.check_out")}: ${co}`;
  }

  function pickDay(d) {
    if (!checkOut && d > checkIn && !rangeHasBlock(checkIn, d)) {
      checkOut = addDays(d, 1);
    } else {
      checkIn = d;
      checkOut = null;
    }
    renderCal();
  }

  function rangeHasBlock(from, toInclusive) {
    let cur = from;
    while (cur <= toInclusive) {
      if (dayState[cur]) return true;
      cur = addDays(cur, 1);
    }
    return false;
  }

  renderCal();

  const form = document.getElementById("walkin-form");
  let lookupTimer = null;
  for (const name of ["phone", "email"]) {
    form.elements[name].addEventListener("blur", () => {
      clearTimeout(lookupTimer);
      lookupTimer = setTimeout(() => doLookup(form), 200);
    });
  }

  async function doLookup(form) {
    const phone = form.elements.phone.value.trim();
    const email = form.elements.email.value.trim();
    if (!phone && !email) return;
    try {
      const c = await api.lookupClient({ phone: phone || null, email: email || null });
      if (!c) return;
      for (const k of ["first_name", "last_name", "phone", "email", "doc_kind", "doc_number"]) {
        const v = c[k];
        if (v && !form.elements[k].value) form.elements[k].value = v;
      }
      document.getElementById("lookup-hint").style.display = "block";
    } catch {}
  }

  document.getElementById("walkin-cancel").onclick = () => (mount.innerHTML = "");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      room_id: Number(roomId),
      check_in: checkIn,
      check_out: checkOut || addDays(checkIn, 1),
      guests: Number(fd.get("guests") || 1),
      first_name: fd.get("first_name").trim(),
      last_name: fd.get("last_name").trim() || null,
      phone: fd.get("phone").trim() || null,
      email: fd.get("email").trim() || null,
      doc_kind: fd.get("doc_kind") || null,
      doc_number: fd.get("doc_number").trim() || null,
    };
    try {
      await api.createWalkinBooking(payload);
      mount.innerHTML = "";
      if (onSuccess) onSuccess();
    } catch (err) {
      document.getElementById("walkin-err").textContent = err.message;
    }
  });
}

function addDays(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
