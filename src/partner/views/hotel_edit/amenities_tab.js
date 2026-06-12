// Amenities tab — выбор удобств отеля (общие + питание) + время заезда
// и выезда. Перечень и группировка живут в widgets/amenities_spec.js,
// серверное хранение: hotel.amenities JSONB list[str], hotel.checkin_time
// / checkout_time TIME.

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { escapeHtml } from "../../../util.js";
import { HOTEL_AMENITIES_BY_SECTION } from "../../../widgets/amenities_spec.js";

import { state } from "./index.js";

function fmtTimeValue(v) {
  // Backend отдаёт "HH:MM:SS" или "HH:MM"; <input type="time"> ждёт "HH:MM".
  if (!v) return "";
  return v.slice(0, 5);
}

function sectionHtml(section, selected, canEdit) {
  const disabled = canEdit ? "" : "disabled";
  return `
    <fieldset class="amenities-section">
      <legend>${escapeHtml(t("amenity.section." + section.section))}</legend>
      <div class="amenities-grid">
        ${section.kinds.map((kind) => {
          const checked = selected.has(kind) ? "checked" : "";
          return `<label class="amenity-row">
            <input type="checkbox" name="am-${kind}" ${checked} ${disabled} />
            <span>${escapeHtml(t("amenity." + kind))}</span>
          </label>`;
        }).join("")}
      </div>
    </fieldset>`;
}

export function renderAmenitiesTab(body, id) {
  const h = state.hotel;
  const canEdit = api.canDo("manage_hotel", h?.owner_user_id);
  const selected = new Set(h?.amenities || []);
  const ci = fmtTimeValue(h?.checkin_time);
  const co = fmtTimeValue(h?.checkout_time);
  const disabled = canEdit ? "" : "disabled";

  body.innerHTML = `
    <form id="form-amenities">
      ${HOTEL_AMENITIES_BY_SECTION.map((s) => sectionHtml(s, selected, canEdit)).join("")}
      <fieldset class="amenities-section">
        <legend>${escapeHtml(t("amenity.section.checkin_checkout"))}</legend>
        <div class="form-row form-row--inline">
          <label>${escapeHtml(t("rooms.check_in"))}
            <input type="time" name="checkin_time" value="${ci}" ${disabled} />
          </label>
          <label>${escapeHtml(t("rooms.check_out"))}
            <input type="time" name="checkout_time" value="${co}" ${disabled} />
          </label>
        </div>
      </fieldset>
      ${canEdit ? `<button class="primary full" id="btn-save">${t("app.save")}</button>` : ""}
      <div id="form-err" class="error"></div>
    </form>`;

  if (!canEdit) return;

  document.getElementById("btn-save").onclick = async (e) => {
    e.preventDefault();
    const form = document.getElementById("form-amenities");
    const amenities = [];
    for (const s of HOTEL_AMENITIES_BY_SECTION) {
      for (const kind of s.kinds) {
        if (form.elements["am-" + kind]?.checked) amenities.push(kind);
      }
    }
    const payload = {
      amenities,
      checkin_time: form.elements.checkin_time.value || null,
      checkout_time: form.elements.checkout_time.value || null,
    };
    try {
      const updated = await api.updateHotel(id, payload);
      state.hotel = updated;
      document.getElementById("form-err").innerHTML = `<span class="success">${t("avail.saved")}</span>`;
    } catch (err) {
      document.getElementById("form-err").textContent = t("app.error", { msg: err.message });
    }
  };
}
