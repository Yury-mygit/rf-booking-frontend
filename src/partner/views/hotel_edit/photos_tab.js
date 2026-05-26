// Photos tab — список фото с пере-ордером (up/down) + удаление + загрузка.
// При каждой мутации (move/delete/upload) делаем switchTab("photos") для
// рефреша блока — это проще чем in-place re-render.

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { escapeHtml } from "../../../util.js";

import { state, switchTab } from "./index.js";

export function renderPhotosTab(body, id) {
  const photos = state.hotel.photos || [];
  const canEdit = api.canDo("manage_hotel", state.hotel?.owner_user_id);
  body.innerHTML = `
    <div id="photos-list">
      ${photos.length === 0
        ? `<p class="muted">${t("photos.empty")}</p>`
        : photos
            .map(
              (url, i) => `
              <div class="photo-row">
                <img class="photo-thumb" src="${escapeHtml(url)}" alt="" />
                <div class="photo-meta">
                  ${i === 0 ? `<span class="status-pill published">${t("photos.main")}</span>` : ""}
                  <div class="meta" style="word-break:break-all">${escapeHtml(url)}</div>
                </div>
                ${canEdit ? `<div class="photo-actions">
                  <button class="secondary" data-up="${i}" ${i === 0 ? "disabled" : ""}>${t("photos.up")}</button>
                  <button class="secondary" data-down="${i}" ${i === photos.length - 1 ? "disabled" : ""}>${t("photos.down")}</button>
                  <button class="danger" data-del="${escapeHtml(url)}">${t("photos.delete")}</button>
                </div>` : ""}
              </div>`,
            )
            .join("")}
    </div>
    ${canEdit ? `<div class="photo-upload">
      <label class="meta">${t("photos.allowed")}</label>
      <input type="file" id="photo-file" accept="image/jpeg,image/png,image/webp" />
      <button class="primary" id="photo-upload-btn" disabled>${t("photos.upload")}</button>
      <div id="photo-status" class="meta"></div>
    </div>` : ""}
  `;

  if (!canEdit) return;

  body.querySelectorAll("button[data-up]").forEach((b) => {
    b.onclick = () => moveAndSave(Number(b.dataset.up), -1, id);
  });
  body.querySelectorAll("button[data-down]").forEach((b) => {
    b.onclick = () => moveAndSave(Number(b.dataset.down), +1, id);
  });
  body.querySelectorAll("button[data-del]").forEach((b) => {
    b.onclick = () => deletePhoto(b.dataset.del, id);
  });

  const fileInput = document.getElementById("photo-file");
  const uploadBtn = document.getElementById("photo-upload-btn");
  fileInput.onchange = () => {
    uploadBtn.disabled = !fileInput.files || fileInput.files.length === 0;
  };
  uploadBtn.onclick = () => uploadPhoto(fileInput, id);
}

async function moveAndSave(index, delta, hotelId) {
  const photos = [...(state.hotel.photos || [])];
  const j = index + delta;
  if (j < 0 || j >= photos.length) return;
  [photos[index], photos[j]] = [photos[j], photos[index]];
  try {
    const res = await api.reorderPhotos(hotelId, photos);
    state.hotel.photos = res.photos;
    switchTab("photos", hotelId);
  } catch (e) {
    alert(e.message);
  }
}

async function deletePhoto(url, hotelId) {
  if (!confirm(t("photos.delete") + " ?")) return;
  try {
    await api.deletePhoto(hotelId, url);
    state.hotel.photos = (state.hotel.photos || []).filter((u) => u !== url);
    switchTab("photos", hotelId);
  } catch (e) {
    alert(e.message);
  }
}

async function uploadPhoto(fileInput, hotelId) {
  const f = fileInput.files && fileInput.files[0];
  if (!f) return;
  const statusEl = document.getElementById("photo-status");
  statusEl.textContent = t("photos.uploading");
  try {
    const res = await api.uploadPhoto(hotelId, f);
    state.hotel.photos = res.photos;
    switchTab("photos", hotelId);
  } catch (e) {
    statusEl.innerHTML = `<span class="error">${escapeHtml(e.message)}</span>`;
  }
}
