// Rules subform (TBB-62/TBB-64): 3 правила отеля — минимальный срок,
// способ бронирования, отмена. Auto-save per-field через savePartial.
// Радио заменены на select (TBB-64) с 4 вариантами каждый. Ошибка →
// rollback UI + showToast.

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { escapeHtml } from "../../../util.js";
import { showToast } from "../../../widgets/toast.js";

import { state } from "./index.js";

const BOOKING_MODES = ["instant", "manual_confirmation", "phone_confirmation", "advance_payment"];
const CANCEL_POLICIES = ["free", "hold_after_days", "non_refundable", "first_night_only"];

async function savePartial(id, payload, rollback) {
  try {
    const updated = await api.updateHotel(id, payload);
    state.hotel = updated;
  } catch {
    rollback();
    showToast(t("amenity.save_error"));
  }
}

function optionHtml(value, selectedValue, labelKey) {
  const sel = value === selectedValue ? "selected" : "";
  return `<option value="${value}" ${sel}>${escapeHtml(t(labelKey + value))}</option>`;
}

export function renderRulesSubform(body, id) {
  const h = state.hotel;
  const canEdit = api.canDo("manage_hotel", h?.owner_user_id);
  const readonlyAttr = canEdit ? "" : "disabled";

  const minStay = h?.min_stay_nights ?? 1;
  const bookingMode = h?.booking_mode ?? "instant";
  const cancelPolicy = h?.cancel_policy ?? "free";
  const cancelDays = h?.cancel_days_threshold ?? "";
  const cancelPct = h?.cancel_penalty_pct ?? "";
  const holdEnabled = cancelPolicy === "hold_after_days";

  const bookingModeOpts = BOOKING_MODES
    .map((v) => optionHtml(v, bookingMode, "rules.booking_mode."))
    .join("");
  const cancelPolicyOpts = CANCEL_POLICIES
    .map((v) => optionHtml(v, cancelPolicy, "rules.cancel."))
    .join("");

  body.innerHTML = `
    <fieldset class="amenities-section">
      <legend>${escapeHtml(t("rules.min_stay.label"))}</legend>
      <label class="amenity-row">
        <input type="number" name="min_stay_nights" min="1" max="30"
               value="${escapeHtml(String(minStay))}" ${readonlyAttr} />
        <span class="muted">${escapeHtml(t("rules.min_stay.hint"))}</span>
      </label>
    </fieldset>

    <fieldset class="amenities-section">
      <legend>${escapeHtml(t("rules.booking_mode.label"))}</legend>
      <label class="amenity-row">
        <select name="booking_mode" ${readonlyAttr}>${bookingModeOpts}</select>
      </label>
    </fieldset>

    <fieldset class="amenities-section">
      <legend>${escapeHtml(t("rules.cancel.label"))}</legend>
      <label class="amenity-row">
        <select name="cancel_policy" ${readonlyAttr}>${cancelPolicyOpts}</select>
      </label>
      <div class="rules-cancel-params" ${holdEnabled ? "" : "hidden"}>
        <label class="amenity-row">
          <span>${escapeHtml(t("rules.cancel.days_label"))}</span>
          <input type="number" name="cancel_days_threshold" min="0" max="365"
                 value="${escapeHtml(String(cancelDays))}" ${readonlyAttr} />
        </label>
        <label class="amenity-row">
          <span>${escapeHtml(t("rules.cancel.pct_label"))}</span>
          <input type="number" name="cancel_penalty_pct" min="0" max="100"
                 value="${escapeHtml(String(cancelPct))}" ${readonlyAttr} />
        </label>
      </div>
    </fieldset>
  `;

  if (!canEdit) return;

  const minStayInput = body.querySelector('input[name="min_stay_nights"]');
  minStayInput.onblur = () => {
    const v = parseInt(minStayInput.value, 10);
    if (!Number.isFinite(v) || v < 1 || v > 30) {
      minStayInput.value = String(state.hotel?.min_stay_nights ?? 1);
      return;
    }
    if (v === (state.hotel?.min_stay_nights ?? 1)) return;
    const prev = state.hotel?.min_stay_nights ?? 1;
    savePartial(id, { min_stay_nights: v }, () => {
      minStayInput.value = String(prev);
    });
  };

  const bookingModeSelect = body.querySelector('select[name="booking_mode"]');
  bookingModeSelect.onchange = () => {
    const value = bookingModeSelect.value;
    const prev = state.hotel?.booking_mode ?? "instant";
    if (value === prev) return;
    savePartial(id, { booking_mode: value }, () => {
      bookingModeSelect.value = prev;
    });
  };

  const cancelPolicySelect = body.querySelector('select[name="cancel_policy"]');
  const cancelParams = body.querySelector(".rules-cancel-params");
  cancelPolicySelect.onchange = () => {
    const value = cancelPolicySelect.value;
    const prev = state.hotel?.cancel_policy ?? "free";
    if (value === prev) return;
    // Показать/скрыть params сразу (без ожидания save).
    cancelParams.hidden = value !== "hold_after_days";
    // При переходе на любой не-hold policy — очистить threshold/pct
    // (иначе в БД останутся устаревшие params для отображения клиенту).
    const payload = { cancel_policy: value };
    if (value !== "hold_after_days") {
      payload.cancel_days_threshold = null;
      payload.cancel_penalty_pct = null;
    }
    savePartial(id, payload, () => {
      cancelPolicySelect.value = prev;
      cancelParams.hidden = prev !== "hold_after_days";
    });
  };

  const daysInput = body.querySelector('input[name="cancel_days_threshold"]');
  daysInput.onblur = () => {
    const raw = daysInput.value.trim();
    const v = raw === "" ? null : parseInt(raw, 10);
    if (v !== null && (!Number.isFinite(v) || v < 0 || v > 365)) {
      daysInput.value = state.hotel?.cancel_days_threshold ?? "";
      return;
    }
    if (v === (state.hotel?.cancel_days_threshold ?? null)) return;
    const prev = state.hotel?.cancel_days_threshold ?? null;
    savePartial(id, { cancel_days_threshold: v }, () => {
      daysInput.value = prev == null ? "" : String(prev);
    });
  };

  const pctInput = body.querySelector('input[name="cancel_penalty_pct"]');
  pctInput.onblur = () => {
    const raw = pctInput.value.trim();
    const v = raw === "" ? null : parseInt(raw, 10);
    if (v !== null && (!Number.isFinite(v) || v < 0 || v > 100)) {
      pctInput.value = state.hotel?.cancel_penalty_pct ?? "";
      return;
    }
    if (v === (state.hotel?.cancel_penalty_pct ?? null)) return;
    const prev = state.hotel?.cancel_penalty_pct ?? null;
    savePartial(id, { cancel_penalty_pct: v }, () => {
      pctInput.value = prev == null ? "" : String(prev);
    });
  };
}
