import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { navigate } from "../../router.js";
import { setTitle } from "../../topbar.js";
import { escapeHtml } from "../../util.js";
import {
  ROOM_AMENITIES_BY_SECTION,
  ROOM_PAID_ALLOWED,
} from "../../widgets/amenities_spec.js";
import { showFloatingToast } from "../../widgets/toast.js";

const MAIN_FIELDS = [
  ["name_ru", "room.name_ru", "input", { required: true }],
  ["capacity", "room.capacity", "input-number", { required: true, min: 1, max: 20 }],
  ["single_beds", "room.single_beds", "input-number"],
  ["double_beds", "room.double_beds", "input-number"],
  ["price_kgs", "room.price_kgs", "input-number", { required: true, min: 0 }],
  ["floor", "room.floor", "input-number"],
];

const DESCRIPTION_FIELDS = [
  ["name_ky", "room.name_ky", "input"],
  ["name_en", "room.name_en", "input"],
  ["description_ru", "room.description_ru", "textarea"],
  ["description_ky", "room.description_ky", "textarea"],
  ["description_en", "room.description_en", "textarea"],
];

const TABS = ["main", "description", "photos", "amenities"];

let _state = { hotelId: null, roomId: null, isNew: false, room: null, active: "main" };

const ROOM_FIELDS = [...MAIN_FIELDS, ...DESCRIPTION_FIELDS];
const ROOM_FIELD_BY_NAME = new Map(ROOM_FIELDS.map((field) => [field[0], field]));

function fieldHtml([k, key, kind, rules = {}], value) {
  const required = rules.required ? "required" : "";
  const marker = rules.required ? " *" : "";
  if (kind === "textarea") {
    return `<div class="form-row"><label>${t(key)}${marker}</label>
      <textarea name="${k}" ${required}>${escapeHtml(value)}</textarea></div>`;
  }
  const inputType = kind === "input-number" ? "number" : "text";
  const min = rules.min === undefined ? "" : `min="${rules.min}"`;
  const max = rules.max === undefined ? "" : `max="${rules.max}"`;
  return `<div class="form-row"><label>${t(key)}${marker}</label>
    <input type="${inputType}" name="${k}" value="${escapeHtml(value)}" ${required} ${min} ${max} /></div>`;
}

function fieldValidationMessage(field, raw) {
  const [, key, kind, rules = {}] = field;
  const label = t(key);
  if (rules.required && raw === "") return t("validation.required", { field: label });
  if (kind !== "input-number" || raw === "") return "";
  const value = Number(raw);
  if (!Number.isFinite(value)) return t("validation.invalid", { field: label });
  if (rules.min !== undefined && rules.max !== undefined && (value < rules.min || value > rules.max)) {
    return t("validation.range", { field: label, min: rules.min, max: rules.max });
  }
  if (rules.min !== undefined && value < rules.min) {
    return t("validation.min", { field: label, min: rules.min });
  }
  return "";
}

function validateRoomForm(form, fields) {
  for (const field of fields) {
    const input = form.elements[field[0]];
    const message = fieldValidationMessage(field, input.value.trim());
    input.setCustomValidity(message);
    if (message) {
      input.reportValidity();
      input.focus();
      return false;
    }
  }
  return form.reportValidity();
}

function roomValidationMessage(error) {
  if (!Array.isArray(error?.detail)) return t("app.error", { msg: error.message });
  const issue = error.detail.find((item) => ROOM_FIELD_BY_NAME.has(item?.loc?.at(-1)));
  if (!issue) return t("app.error", { msg: error.message });
  const field = ROOM_FIELD_BY_NAME.get(issue.loc.at(-1));
  const [, key, , rules = {}] = field;
  const label = t(key);
  if (issue.type === "missing" || issue.type === "string_too_short") {
    return t("validation.required", { field: label });
  }
  if (rules.min !== undefined && rules.max !== undefined) {
    return t("validation.range", { field: label, min: rules.min, max: rules.max });
  }
  if (rules.min !== undefined) return t("validation.min", { field: label, min: rules.min });
  return t("validation.invalid", { field: label });
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
  else if (name === "amenities") return renderAmenitiesTab(body);
  wireSaveHandler();
}

function renderAmenitiesTab(body) {
  const canEdit = canManageRooms();
  const items = _state.room.amenities || [];
  const byKind = new Map(items.map((it) => [it.kind, it]));
  const disabled = canEdit ? "" : "disabled";
  body.innerHTML = `
    <form id="form-amenities">
      ${ROOM_AMENITIES_BY_SECTION.map((sec) => `
        <fieldset class="amenities-section">
          <legend>${escapeHtml(t("amenity.section." + sec.section))}</legend>
          <div class="amenities-grid">
            ${sec.kinds.map((kind) => {
              const cur = byKind.get(kind);
              const checked = cur ? "checked" : "";
              const paidChecked = cur?.paid ? "checked" : "";
              const paidShown = ROOM_PAID_ALLOWED.has(kind);
              return `<div class="amenity-row">
                <label>
                  <input type="checkbox" name="am-${kind}" ${checked} ${disabled} />
                  <span>${escapeHtml(t("amenity." + kind))}</span>
                </label>
                ${paidShown ? `<label class="amenity-paid">
                  <input type="checkbox" name="paid-${kind}" ${paidChecked} ${disabled} ${cur ? "" : "disabled"} />
                  <span>${escapeHtml(t("amenity.paid"))}</span>
                </label>` : ""}
              </div>`;
            }).join("")}
          </div>
        </fieldset>
      `).join("")}
      ${canEdit ? `<button class="primary full" id="btn-save-am">${t("app.save")}</button>` : ""}
      <div id="err" class="error"></div>
    </form>`;

  if (!canEdit) return;

  // Включение «paid» доступно только если включён сам amenity.
  body.querySelectorAll("input[type=checkbox][name^=am-]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const kind = cb.name.slice(3);
      const paid = body.querySelector(`input[name="paid-${kind}"]`);
      if (!paid) return;
      paid.disabled = !cb.checked;
      if (!cb.checked) paid.checked = false;
    });
  });

  document.getElementById("btn-save-am").onclick = async (e) => {
    e.preventDefault();
    const form = document.getElementById("form-amenities");
    const amenities = [];
    for (const sec of ROOM_AMENITIES_BY_SECTION) {
      for (const kind of sec.kinds) {
        if (!form.elements["am-" + kind]?.checked) continue;
        const row = { kind };
        if (ROOM_PAID_ALLOWED.has(kind) && form.elements["paid-" + kind]?.checked) {
          row.paid = true;
        }
        amenities.push(row);
      }
    }
    try {
      const updated = await api.updateRoom(_state.hotelId, _state.roomId, { amenities });
      _state.room = updated;
      document.getElementById("err").textContent = "";
      showFloatingToast(t("avail.saved"));
    } catch (err) {
      document.getElementById("err").textContent = "";
      showFloatingToast(t("app.error", { msg: err.message }), { variant: "error" });
    }
  };
}

function canManageRooms() {
  return api.canDo("manage_rooms", api.activeOwnerId());
}

function publishBlockHtml(room) {
  if (_state.isNew || !room) return "";
  if (!canManageRooms()) return "";
  const isPub = room.status === "published";
  const action = isPub ? t("room.unpublish_action") : t("room.publish_action");
  const hint = isPub ? t("room.unpublish_hint") : t("room.publish_hint");
  const chipCls = isPub ? "published" : "draft";
  const chipText = isPub ? t("room.status.published") : t("room.status.draft");
  return `
    <div class="publish-block" style="margin-top:14px;padding:10px;border:1px solid var(--border,#ddd);border-radius:4px">
      <div style="margin-bottom:8px"><span class="status-pill ${chipCls}">${chipText}</span></div>
      <button class="secondary full" id="btn-publish">${action}</button>
      <p class="meta" style="margin:6px 0 0">${hint}</p>
    </div>`;
}

function mainFormHtml(room) {
  const canEdit = canManageRooms();
  return `
    <form id="form">
      ${MAIN_FIELDS.map((field) =>
        fieldHtml(field, room?.[field[0]] ?? "")
      ).join("")}
      ${canEdit ? `<button class="primary full" id="btn-save">${t("app.save")}</button>` : ""}
      ${publishBlockHtml(room)}
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
      ${DESCRIPTION_FIELDS.map((field) =>
        fieldHtml(field, room?.[field[0]] ?? "")
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
    if (!validateRoomForm(form, activeFields)) return;
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
        document.getElementById("err").textContent = "";
        showFloatingToast(t("avail.saved"));
      }
    } catch (e) {
      document.getElementById("err").textContent = "";
      showFloatingToast(roomValidationMessage(e), { variant: "error" });
    }
  };

  document.getElementById("btn-del")?.addEventListener("click", async (ev) => {
    ev.preventDefault();
    if (!confirm(t("room.delete_confirm"))) return;
    try {
      await api.deleteRoom(_state.hotelId, _state.roomId);
      navigate(`#/partner/hotel/${_state.hotelId}/status/rooms`);
    } catch (e) {
      document.getElementById("err").textContent = t("app.error", { msg: e.message });
    }
  });

  document.getElementById("btn-publish")?.addEventListener("click", async (ev) => {
    ev.preventDefault();
    const next = _state.room.status === "published" ? "draft" : "published";
    try {
      _state.room = await api.setRoomStatus(_state.roomId, next);
      switchTab("main");
    } catch (e) {
      document.getElementById("err").textContent = t("app.error", { msg: e.message });
    }
  });
}
