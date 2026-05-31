import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { navigate } from "../../router.js";
import { setTitle } from "../../topbar.js";
import { escapeHtml } from "../../util.js";

const MAIN_FIELDS = [
  ["name_ru", "room.name_ru", "input"],
  ["capacity", "room.capacity", "input-number"],
  ["single_beds", "room.single_beds", "input-number"],
  ["double_beds", "room.double_beds", "input-number"],
  ["price_kgs", "room.price_kgs", "input-number"],
  ["floor", "room.floor", "input-number"],
];

const DESCRIPTION_FIELDS = [
  ["name_ky", "room.name_ky", "input"],
  ["name_en", "room.name_en", "input"],
  ["description_ru", "room.description_ru", "textarea"],
  ["description_ky", "room.description_ky", "textarea"],
  ["description_en", "room.description_en", "textarea"],
];

const TABS = ["main", "description", "photos"];

let _state = { hotelId: null, roomId: null, isNew: false, room: null, active: "main" };

function fieldHtml([k, key, kind], value) {
  if (kind === "textarea") {
    return `<div class="form-row"><label>${t(key)}</label>
      <textarea name="${k}">${escapeHtml(value)}</textarea></div>`;
  }
  const inputType = kind === "input-number" ? "number" : "text";
  return `<div class="form-row"><label>${t(key)}</label>
    <input type="${inputType}" name="${k}" value="${escapeHtml(value)}" /></div>`;
}

export async function renderRoomEdit({ hotelId, roomId }) {
  const isNew = roomId === "new";
  _state = { hotelId, roomId, isNew, room: null, active: "main" };

  const app = document.getElementById("app");
  app.innerHTML = t("app.loading");

  if (isNew) {
    setTitle(`${t("pageTitle.roomEdit")} / ${t("room.title.new")}`);
    app.innerHTML = mainFormHtml(null);
    wireSaveHandler();
    return;
  }

  try {
    _state.room = await api.getRoom(hotelId, roomId);
  } catch (e) {
    app.innerHTML = `<div class="error">${t("app.error", { msg: e.message })}</div>`;
    return;
  }

  setTitle(`${t("pageTitle.roomEdit")} / ${t("room.title.edit")}`);
  app.innerHTML = `
    <div class="tabs">
      ${TABS.map((name) =>
        `<button class="tab" data-tab="${name}">${t("edit.section." + name)}</button>`
      ).join("")}
    </div>
    <div id="tab-body"></div>
  `;
  document.querySelectorAll(".tab").forEach((b) => {
    b.onclick = () => switchTab(b.dataset.tab);
  });
  switchTab(_state.active);
}

function switchTab(name) {
  _state.active = name;
  document.querySelectorAll(".tab").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === name),
  );
  const body = document.getElementById("tab-body");
  if (name === "main") body.innerHTML = mainFormHtml(_state.room);
  else if (name === "description") body.innerHTML = descriptionFormHtml(_state.room);
  else if (name === "photos") return renderPhotosTab(body);
  wireSaveHandler();
}

function canManageRooms() {
  return api.canDo("manage_rooms", api.activeOwnerId());
}

function mainFormHtml(room) {
  const canEdit = canManageRooms();
  return `
    <form id="form">
      ${MAIN_FIELDS.map(([k, key, kind]) =>
        fieldHtml([k, key, kind], room?.[k] ?? "")
      ).join("")}
      ${canEdit ? `<button class="primary full" id="btn-save">${t("app.save")}</button>` : ""}
      ${canEdit && !_state.isNew ? `<p style="margin-top:10px"><button class="danger" id="btn-del">${t("app.delete")}</button></p>` : ""}
      ${!_state.isNew ? `<p><a class="secondary" style="text-decoration:none;display:inline-block;padding:8px 14px;border:1px solid var(--accent);border-radius:4px;color:var(--accent);background:var(--surface)" href="#/partner/room/${_state.hotelId}/${_state.roomId}/availability">${t("room.availability")}</a></p>` : ""}
      <div id="err" class="error"></div>
    </form>
  `;
}

function descriptionFormHtml(room) {
  const canEdit = canManageRooms();
  return `
    <form id="form">
      ${DESCRIPTION_FIELDS.map(([k, key, kind]) =>
        fieldHtml([k, key, kind], room?.[k] ?? "")
      ).join("")}
      ${canEdit ? `<button class="primary full" id="btn-save">${t("app.save")}</button>` : ""}
      <div id="err" class="error"></div>
    </form>
  `;
}

function renderPhotosTab(body) {
  const photos = _state.room.photos || [];
  const canEdit = canManageRooms();
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
    b.onclick = () => moveAndSave(Number(b.dataset.up), -1);
  });
  body.querySelectorAll("button[data-down]").forEach((b) => {
    b.onclick = () => moveAndSave(Number(b.dataset.down), +1);
  });
  body.querySelectorAll("button[data-del]").forEach((b) => {
    b.onclick = () => deletePhoto(b.dataset.del);
  });

  const fileInput = document.getElementById("photo-file");
  const uploadBtn = document.getElementById("photo-upload-btn");
  fileInput.onchange = () => {
    uploadBtn.disabled = !fileInput.files || fileInput.files.length === 0;
  };
  uploadBtn.onclick = () => uploadPhoto(fileInput);
}

async function moveAndSave(index, delta) {
  const photos = [...(_state.room.photos || [])];
  const j = index + delta;
  if (j < 0 || j >= photos.length) return;
  [photos[index], photos[j]] = [photos[j], photos[index]];
  try {
    const res = await api.reorderRoomPhotos(_state.roomId, photos);
    _state.room.photos = res.photos;
    switchTab("photos");
  } catch (e) {
    alert(e.message);
  }
}

async function deletePhoto(url) {
  if (!confirm("?")) return;
  try {
    await api.deleteRoomPhoto(_state.roomId, url);
    _state.room.photos = (_state.room.photos || []).filter((u) => u !== url);
    switchTab("photos");
  } catch (e) {
    alert(e.message);
  }
}

async function uploadPhoto(fileInput) {
  const f = fileInput.files && fileInput.files[0];
  if (!f) return;
  const statusEl = document.getElementById("photo-status");
  statusEl.textContent = t("photos.uploading");
  try {
    const res = await api.uploadRoomPhoto(_state.roomId, f);
    _state.room.photos = res.photos;
    switchTab("photos");
  } catch (e) {
    statusEl.innerHTML = `<span class="error">${escapeHtml(e.message)}</span>`;
  }
}

function wireSaveHandler() {
  const btn = document.getElementById("btn-save");
  if (!btn) return;
  btn.onclick = async (e) => {
    e.preventDefault();
    const form = document.getElementById("form");
    const payload = {};
    const activeFields = _state.active === "description" ? DESCRIPTION_FIELDS : MAIN_FIELDS;
    for (const [k, , kind] of activeFields) {
      const raw = form[k].value.trim();
      if (raw === "" && !_state.isNew) { payload[k] = null; continue; }
      if (raw === "") continue;
      payload[k] = kind === "input-number" ? Number(raw) : raw;
    }
    try {
      if (_state.isNew) {
        const r = await api.createRoom(_state.hotelId, payload);
        navigate(`#/partner/room/${_state.hotelId}/${r.id}`);
      } else {
        const updated = await api.updateRoom(_state.hotelId, _state.roomId, payload);
        _state.room = updated;
        document.getElementById("err").innerHTML = `<span class="success">${t("avail.saved")}</span>`;
      }
    } catch (e) {
      document.getElementById("err").textContent = t("app.error", { msg: e.message });
    }
  };

  document.getElementById("btn-del")?.addEventListener("click", async (ev) => {
    ev.preventDefault();
    if (!confirm(t("room.delete_confirm"))) return;
    try {
      await api.deleteRoom(_state.hotelId, _state.roomId);
      navigate(`#/partner/hotel/${_state.hotelId}/rooms`);
    } catch (e) {
      document.getElementById("err").textContent = t("app.error", { msg: e.message });
    }
  });
}
