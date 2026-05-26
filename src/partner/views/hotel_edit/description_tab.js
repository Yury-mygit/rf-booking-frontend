// Description tab — форма редактирования полей отеля (name_*, description_*,
// city, address, lat, lng, photos URL list). Используется также для isNew
// flow в index.js (renderNewHotelForm — та же форма без вкладок).

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { navigate } from "../../../router.js";
import { escapeHtml } from "../../../util.js";

import { state } from "./index.js";

const FIELDS = [
  ["name_ru", "hotel.name_ru", "input"],
  ["name_ky", "hotel.name_ky", "input"],
  ["name_en", "hotel.name_en", "input"],
  ["description_ru", "hotel.description_ru", "textarea"],
  ["description_ky", "hotel.description_ky", "textarea"],
  ["description_en", "hotel.description_en", "textarea"],
  ["city", "hotel.city", "input"],
  ["address", "hotel.address", "input"],
  ["lat", "hotel.lat", "input-number"],
  ["lng", "hotel.lng", "input-number"],
];

function descriptionFormHtml(hotel, canEdit = true) {
  const ro = canEdit ? "" : "readonly";
  return `
    <form id="form">
      ${FIELDS.map(([k, key, kind]) => {
        const v = hotel?.[k] ?? "";
        if (kind === "textarea") {
          return `<div class="form-row"><label>${t(key)}</label>
            <textarea name="${k}" ${ro}>${escapeHtml(v)}</textarea></div>`;
        }
        const inputType = kind === "input-number" ? "number" : "text";
        const step = kind === "input-number" ? 'step="any"' : "";
        return `<div class="form-row"><label>${t(key)}</label>
          <input type="${inputType}" ${step} name="${k}" value="${escapeHtml(v)}" ${ro} /></div>`;
      }).join("")}
      <div class="form-row"><label>${t("hotel.photos_urls")}</label>
        <input name="photos" value="${escapeHtml((hotel?.photos || []).join(", "))}" ${ro} /></div>
      ${canEdit ? `<button class="primary full" id="btn-save">${t("app.save")}</button>` : ""}
      <div id="form-err" class="error"></div>
    </form>
  `;
}

export function renderDescriptionTab(body, id) {
  const canEdit = api.canDo("manage_hotel", state.hotel?.owner_user_id);
  body.innerHTML = descriptionFormHtml(state.hotel, canEdit);
  if (canEdit) wireSaveHandler(false, id);
}

export function renderNewHotelForm(app) {
  app.innerHTML = descriptionFormHtml(null);
  wireSaveHandler(true, null);
}

function wireSaveHandler(isNew, id) {
  document.getElementById("btn-save").onclick = async (e) => {
    e.preventDefault();
    const form = document.getElementById("form");
    const payload = {};
    for (const [k, , kind] of FIELDS) {
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
        navigate("#/partner/hotel/" + created.id);
      } else {
        const updated = await api.updateHotel(id, payload);
        state.hotel = updated;
        document.getElementById("form-err").innerHTML = `<span class="success">${t("avail.saved")}</span>`;
      }
    } catch (e) {
      document.getElementById("form-err").textContent = t("app.error", { msg: e.message });
    }
  };
}
