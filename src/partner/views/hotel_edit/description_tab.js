// Description tab — форма редактирования русских name/description,
// city, address, lat, lng, photos URL list). Используется также для isNew
// flow в index.js (renderNewHotelForm — та же форма без вкладок).

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { navigate } from "../../../router.js";
import { escapeHtml } from "../../../util.js";
import { showFloatingToast } from "../../../widgets/toast.js";

import { state } from "./index.js";

// TBB-72: destinations загружаются один раз при первом render'е формы.
// Хранятся в модуле — при переоткрытии не долбим backend.
let _destinationsCache = null;

async function loadDestinations() {
  if (_destinationsCache) return _destinationsCache;
  _destinationsCache = await api.publicDestinations();
  return _destinationsCache;
}

const FIELDS = [
  ["name_ru", "hotel.name_ru", "input", null, true],
  ["description_ru", "hotel.description_ru", "textarea"],
  ["destination_id", "hotel.destination", "select-destinations", null, true],
  ["city", "hotel.city", "input", null, true],
  ["address", "hotel.address", "input"],
  ["lat", "hotel.lat", "input-number"],
  ["lng", "hotel.lng", "input-number"],
  ["meals", "hotel.meals", "select", ["none", "breakfast", "full_board"]],
];

function descriptionFormHtml(hotel, canEdit = true) {
  const ro = canEdit ? "" : "readonly";
  return `
    <form id="form">
      ${FIELDS.map(([k, key, kind, opts, required]) => {
        const requiredAttr = required ? "required" : "";
        const label = `${t(key)}${required ? ' <span aria-hidden="true">*</span>' : ""}`;
        if (kind === "checkbox") {
          const checked = hotel?.[k] ? "checked" : "";
          const disabled = canEdit ? "" : "disabled";
          return `<div class="form-row form-row--inline">
            <label><input type="checkbox" name="${k}" ${checked} ${disabled} />
              ${t(key)}</label></div>`;
        }
        if (kind === "select") {
          const cur = hotel?.[k] ?? opts[0];
          const disabled = canEdit ? "" : "disabled";
          return `<div class="form-row"><label>${label}</label>
            <select name="${k}" ${disabled}>
              ${opts.map((o) => `<option value="${o}" ${o === cur ? "selected" : ""}>${t(`${key}_${o}`)}</option>`).join("")}
            </select></div>`;
        }
        if (kind === "select-destinations") {
          const cur = hotel?.[k] ?? "";
          const disabled = canEdit ? "" : "disabled";
          const placeholder = `<option value="" ${cur === "" ? "selected" : ""} disabled>—</option>`;
          const opts = (_destinationsCache || [])
            .map((d) => `<option value="${d.id}" ${Number(cur) === d.id ? "selected" : ""}>${escapeHtml(d.name_ru)}</option>`)
            .join("");
          return `<div class="form-row"><label>${label}</label>
            <select name="${k}" ${requiredAttr} ${disabled}>${placeholder}${opts}</select></div>`;
        }
        const v = hotel?.[k] ?? "";
        if (kind === "textarea") {
          return `<div class="form-row"><label>${label}</label>
            <textarea class="hotel-description-autogrow" name="${k}" ${requiredAttr} ${ro}>${escapeHtml(v)}</textarea></div>`;
        }
        const inputType = kind === "input-number" ? "number" : "text";
        const step = kind === "input-number" ? 'step="any"' : "";
        return `<div class="form-row"><label>${label}</label>
          <input type="${inputType}" ${step} name="${k}" value="${escapeHtml(v)}" ${requiredAttr} ${ro} /></div>`;
      }).join("")}
      <div class="form-row"><label>${t("hotel.photos_urls")}</label>
        <input name="photos" value="${escapeHtml((hotel?.photos || []).join(", "))}" ${ro} /></div>
      ${canEdit ? `<button class="primary full" id="btn-save">${t("app.save")}</button>` : ""}
    </form>
  `;
}

const REQUIRED_FIELDS = FIELDS.filter(([, , , , required]) => required);

function validateRequiredFields(form) {
  for (const [name, key] of REQUIRED_FIELDS) {
    const input = form.elements[name];
    const missing = !input.value.trim();
    input.setCustomValidity(missing ? t("validation.required", { field: t(key) }) : "");
    if (missing) {
      input.reportValidity();
      input.focus();
      return false;
    }
  }
  return form.reportValidity();
}

function hotelValidationMessage(error) {
  const labels = new Map(FIELDS.map(([name, key]) => [name, t(key)]));
  if (Array.isArray(error.detail)) {
    const item = error.detail.find((entry) => Array.isArray(entry?.loc));
    const field = item?.loc?.at(-1);
    const label = labels.get(field);
    if (label) {
      if (item.type === "missing" || item.type === "string_too_short") {
        return t("validation.required", { field: label });
      }
      return t("validation.invalid", { field: label });
    }
  }
  return t("app.error", { msg: error.message });
}

export async function renderDescriptionTab(body, id) {
  await loadDestinations();
  const canEdit = api.canDo("manage_hotel", state.hotel?.owner_user_id);
  body.innerHTML = descriptionFormHtml(state.hotel, canEdit);
  initDescriptionAutoGrow(body);
  if (canEdit) wireSaveHandler(false, id);
}

export async function renderNewHotelForm(app) {
  await loadDestinations();
  app.innerHTML = descriptionFormHtml(null);
  initDescriptionAutoGrow(app);
  wireSaveHandler(true, null);
}

function initDescriptionAutoGrow(root) {
  root.querySelectorAll("textarea.hotel-description-autogrow").forEach((textarea) => {
    const resize = () => {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    };
    textarea.addEventListener("input", resize);
    resize();
  });
}

function wireSaveHandler(isNew, id) {
  document.getElementById("btn-save").onclick = async (e) => {
    e.preventDefault();
    const form = document.getElementById("form");
    if (!validateRequiredFields(form)) return;
    const payload = {};
    for (const [k, , kind] of FIELDS) {
      if (kind === "checkbox") {
        payload[k] = form[k].checked;
        continue;
      }
      if (kind === "select") {
        payload[k] = form[k].value;
        continue;
      }
      if (kind === "select-destinations") {
        const raw = form[k].value;
        payload[k] = raw ? Number(raw) : (isNew ? undefined : null);
        continue;
      }
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
        navigate("#/partner/hotel/" + created.id + "/status/readiness");
      } else {
        const updated = await api.updateHotel(id, payload);
        state.hotel = updated;
        showFloatingToast(t("avail.saved"));
      }
    } catch (e) {
      showFloatingToast(hotelValidationMessage(e), { variant: "error" });
    }
  };
}
