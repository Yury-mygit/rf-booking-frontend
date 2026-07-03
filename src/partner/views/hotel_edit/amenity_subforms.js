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

// Стандартные времена для отелей — заезд 14:00, выезд 12:00. Если у отеля
// в БД NULL, backfill'им дефолты фоном при первом просмотре placement-вкладки.
const DEFAULT_CHECKIN = "14:00";
const DEFAULT_CHECKOUT = "12:00";

export function renderPlacementSubform(body, id) {
  const h = state.hotel;
  const canEdit = api.canDo("manage_hotel", h?.owner_user_id);
  const ciBackend = fmtTimeValue(h?.checkin_time);
  const coBackend = fmtTimeValue(h?.checkout_time);
  const ci = ciBackend || DEFAULT_CHECKIN;
  const co = coBackend || DEFAULT_CHECKOUT;
  const disabled = canEdit ? "" : "disabled";

  body.innerHTML = `
    <fieldset class="amenities-section">
      <label class="amenity-row">
        <span>${escapeHtml(t("rooms.check_in"))}</span>
        <input type="time" name="checkin_time" value="${ci}" ${disabled} />
      </label>
      <label class="amenity-row">
        <span>${escapeHtml(t("rooms.check_out"))}</span>
        <input type="time" name="checkout_time" value="${co}" ${disabled} />
      </label>
    </fieldset>`;

  if (!canEdit) return;

  // Backfill defaults в БД если поле было NULL. Без rollback — если PUT
  // провалился, следующий рендер повторит попытку (state.hotel не обновится).
  const backfill = {};
  if (!ciBackend) backfill.checkin_time = DEFAULT_CHECKIN;
  if (!coBackend) backfill.checkout_time = DEFAULT_CHECKOUT;
  if (Object.keys(backfill).length) {
    savePartial(id, backfill, () => {});
  }

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
