// Amenities subforms: general / dining / placement.
// TBB-19 Stage 3 — auto-save per-field (без кнопки Save).
// Checkbox onchange → PUT { amenities: merged }; time onblur → PUT { [key]: value }.
// На ошибку — rollback UI + showToast(amenity.save_error).

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { escapeHtml } from "../../../util.js";
import { showToast } from "../../../widgets/toast.js";
import { HOTEL_AMENITIES_BY_SECTION } from "../../../widgets/amenities_spec.js";

import { state } from "./index.js";

function fmtTimeValue(v) {
  if (!v) return "";
  return v.slice(0, 5);
}

async function savePartial(id, payload, rollback) {
  try {
    const updated = await api.updateHotel(id, payload);
    state.hotel = updated;
  } catch {
    rollback();
    showToast(t("amenity.save_error"));
  }
}

function renderCheckboxSubform(body, id, sectionKey) {
  const spec = HOTEL_AMENITIES_BY_SECTION.find((s) => s.section === sectionKey);
  const h = state.hotel;
  const canEdit = api.canDo("manage_hotel", h?.owner_user_id);
  const selected = new Set(h?.amenities || []);
  const disabled = canEdit ? "" : "disabled";

  body.innerHTML = `
    <fieldset class="amenities-section">
      <div class="amenities-grid">
        ${spec.kinds.map((kind) => {
          const checked = selected.has(kind) ? "checked" : "";
          return `<label class="amenity-row">
            <input type="checkbox" name="am-${kind}" data-kind="${kind}" ${checked} ${disabled} />
            <span>${escapeHtml(t("amenity." + kind))}</span>
          </label>`;
        }).join("")}
      </div>
    </fieldset>`;

  if (!canEdit) return;

  const sectionKinds = new Set(spec.kinds);
  body.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.onchange = () => {
      const kind = cb.dataset.kind;
      const prevChecked = !cb.checked;
      // Merged: kinds чужих секций из state.hotel + актуальный набор в этой секции по DOM.
      const otherKinds = (state.hotel?.amenities || []).filter((k) => !sectionKinds.has(k));
      const localSelected = [...body.querySelectorAll('input[type="checkbox"]:checked')]
        .map((el) => el.dataset.kind);
      const merged = [...otherKinds, ...localSelected];
      savePartial(id, { amenities: merged }, () => {
        cb.checked = prevChecked;
      });
    };
  });
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
    <fieldset class="amenities-section">
      <div class="form-row form-row--inline">
        <label>${escapeHtml(t("rooms.check_in"))}
          <input type="time" name="checkin_time" value="${ci}" ${disabled} />
        </label>
        <label>${escapeHtml(t("rooms.check_out"))}
          <input type="time" name="checkout_time" value="${co}" ${disabled} />
        </label>
      </div>
    </fieldset>`;

  if (!canEdit) return;

  body.querySelectorAll('input[type="time"]').forEach((input) => {
    input.onblur = () => {
      const key = input.name;
      const value = input.value || null;
      const prev = fmtTimeValue(state.hotel?.[key]);
      // Не трогаем backend если значение не изменилось (blur без правок).
      if (value === (prev || null)) return;
      savePartial(id, { [key]: value }, () => {
        input.value = prev;
      });
    };
  });
}
