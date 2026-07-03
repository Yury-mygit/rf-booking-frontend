// Amenities subforms: general / dining / placement.
// TBB-19 Stage 2 — split из amenities_tab.js на 3 renderer'а под subnav.
// Save-логика per-subform (merged amenities для general/dining, свои
// поля для placement). Между Stage 2 и Stage 3 работает Save button;
// Stage 3 заменит на auto-save per-field.

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { escapeHtml } from "../../../util.js";
import { HOTEL_AMENITIES_BY_SECTION } from "../../../widgets/amenities_spec.js";

import { state } from "./index.js";

function fmtTimeValue(v) {
  if (!v) return "";
  return v.slice(0, 5);
}

function renderCheckboxSubform(body, id, sectionKey) {
  const spec = HOTEL_AMENITIES_BY_SECTION.find((s) => s.section === sectionKey);
  const h = state.hotel;
  const canEdit = api.canDo("manage_hotel", h?.owner_user_id);
  const selected = new Set(h?.amenities || []);
  const disabled = canEdit ? "" : "disabled";

  body.innerHTML = `
    <form id="form-amenities-${sectionKey}">
      <fieldset class="amenities-section">
        <div class="amenities-grid">
          ${spec.kinds.map((kind) => {
            const checked = selected.has(kind) ? "checked" : "";
            return `<label class="amenity-row">
              <input type="checkbox" name="am-${kind}" ${checked} ${disabled} />
              <span>${escapeHtml(t("amenity." + kind))}</span>
            </label>`;
          }).join("")}
        </div>
      </fieldset>
      ${canEdit ? `<button class="primary full" id="btn-save-${sectionKey}">${t("app.save")}</button>` : ""}
      <div id="form-err-${sectionKey}" class="error"></div>
    </form>`;

  if (!canEdit) return;

  document.getElementById(`btn-save-${sectionKey}`).onclick = async (e) => {
    e.preventDefault();
    const form = document.getElementById(`form-amenities-${sectionKey}`);
    // Merged: сохраняем чужие секции как есть, свою — переписываем из UI.
    const sectionKinds = new Set(spec.kinds);
    const otherKinds = (state.hotel?.amenities || []).filter((k) => !sectionKinds.has(k));
    const localSelected = spec.kinds.filter((k) => form.elements["am-" + k]?.checked);
    const merged = [...otherKinds, ...localSelected];
    try {
      const updated = await api.updateHotel(id, { amenities: merged });
      state.hotel = updated;
      document.getElementById(`form-err-${sectionKey}`).innerHTML = `<span class="success">${t("avail.saved")}</span>`;
    } catch (err) {
      document.getElementById(`form-err-${sectionKey}`).textContent = t("app.error", { msg: err.message });
    }
  };
}

export function renderGeneralSubform(body, id) {
  renderCheckboxSubform(body, id, "general");
}

export function renderDiningSubform(body, id) {
  renderCheckboxSubform(body, id, "dining");
}

export function renderPlacementSubform(body, id) {
  const h = state.hotel;
  const canEdit = api.canDo("manage_hotel", h?.owner_user_id);
  const ci = fmtTimeValue(h?.checkin_time);
  const co = fmtTimeValue(h?.checkout_time);
  const disabled = canEdit ? "" : "disabled";

  body.innerHTML = `
    <form id="form-amenities-placement">
      <fieldset class="amenities-section">
        <div class="form-row form-row--inline">
          <label>${escapeHtml(t("rooms.check_in"))}
            <input type="time" name="checkin_time" value="${ci}" ${disabled} />
          </label>
          <label>${escapeHtml(t("rooms.check_out"))}
            <input type="time" name="checkout_time" value="${co}" ${disabled} />
          </label>
        </div>
      </fieldset>
      ${canEdit ? `<button class="primary full" id="btn-save-placement">${t("app.save")}</button>` : ""}
      <div id="form-err-placement" class="error"></div>
    </form>`;

  if (!canEdit) return;

  document.getElementById("btn-save-placement").onclick = async (e) => {
    e.preventDefault();
    const form = document.getElementById("form-amenities-placement");
    const payload = {
      checkin_time: form.elements.checkin_time.value || null,
      checkout_time: form.elements.checkout_time.value || null,
    };
    try {
      const updated = await api.updateHotel(id, payload);
      state.hotel = updated;
      document.getElementById("form-err-placement").innerHTML = `<span class="success">${t("avail.saved")}</span>`;
    } catch (err) {
      document.getElementById("form-err-placement").textContent = t("app.error", { msg: err.message });
    }
  };
}
