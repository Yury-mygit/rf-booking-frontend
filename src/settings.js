// Settings view — общий для всех блоков. Открывается из шестерёнки в
// topbar (#settings-btn) через openSettings(); back возвращает на тот
// hash, с которого пришли.
//
// 2 таба в bottomnav: «Общие» (язык) / «Платежи» (QR-код).
// QR хранится в localStorage как base64 — для прод нужен backend-endpoint
// (см. follow-up). Достаточно для single-device теста.

import { api } from "./api.js";
import { t, LANG_ORDER, getLang, setLang } from "./i18n.js";
import { navigate } from "./router.js";
import { setTitle, showBack } from "./topbar.js";
import { setBottomNav } from "./bottomnav.js";

const SVG_ATTR = 'viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const TAB_ICONS = {
  general: `<svg ${SVG_ATTR}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
  payments: `<svg ${SVG_ATTR}><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><line x1="14" y1="14" x2="14" y2="18"></line><line x1="18" y1="14" x2="21" y2="14"></line><line x1="14" y1="21" x2="21" y2="21"></line><line x1="18" y1="18" x2="21" y2="18"></line></svg>`,
};
const TABS = ["general", "payments"];

let _state = { active: "general" };
let _returnHash = "#/";

export function openSettings() {
  const cur = location.hash || "#/";
  _returnHash = cur.split("?")[0] === "#/settings" ? "#/" : cur;
  navigate("#/settings");
}

function setSettingsNav() {
  setBottomNav(
    TABS.map((name) => ({
      key: name,
      label: t("settings.tab." + name),
      icon: TAB_ICONS[name],
      active: name === _state.active,
      onClick: () => switchTab(name),
    })),
  );
}

function switchTab(name) {
  _state.active = name;
  setSettingsNav();
  render();
}

export function renderSettings() {
  document.body.dataset.block = "settings";
  setTitle(t("settings.title"));
  showBack(() => navigate(_returnHash));
  setSettingsNav();
  render();
}

async function render() {
  const app = document.getElementById("app");
  if (_state.active === "general") return renderGeneralTab(app);
  if (_state.active === "payments") return renderPaymentsTab(app);
}

// ─── Таб «Общие» ────────────────────────────────────────────────────────────

function renderGeneralTab(app) {
  app.innerHTML = `
    <div class="settings-list">
      <div class="settings-item">
        <div class="settings-label">${t("settings.language")}</div>
        <div class="settings-lang-row" id="settings-lang"></div>
      </div>
    </div>
  `;
  renderLangButtons();
}

function renderLangButtons() {
  const row = document.getElementById("settings-lang");
  if (!row) return;
  const lang = getLang();
  row.innerHTML = LANG_ORDER.map((l) => `
    <button class="settings-lang-btn${l === lang ? " active" : ""}" data-lang="${l}" type="button">${l.toUpperCase()}</button>
  `).join("");
  row.querySelectorAll(".settings-lang-btn").forEach((b) => {
    b.onclick = () => {
      setLang(b.dataset.lang);
      // langchange listener в main.js делает run() → re-render формы
    };
  });
}

// ─── Таб «Платежи» — QR-код (серверное хранение) ────────────────────────────
// Backend: GET/POST/DELETE /api/v1/me/qr; файлы /api/v1/qr/{user_id}/{name}.
// Per-user, не per-hotel — настройка из «Настройки», у каждого юзера свой QR.

async function renderPaymentsTab(app) {
  app.innerHTML = `<p class="muted">${t("app.loading")}</p>`;
  let cur = null;
  try {
    const r = await api.getMyQr();
    cur = r && r.url ? r.url : null;
  } catch (e) {
    app.innerHTML = `<div class="error">${t("app.error", { msg: e.message })}</div>`;
    return;
  }
  app.innerHTML = `
    <div class="settings-list">
      <div class="settings-item">
        <div class="settings-label">${t("settings.qr.title")}</div>
        <div id="qr-preview">
          ${cur
            ? `<img class="qr-image" src="${cur}" alt="QR" />`
            : `<p class="muted">${t("settings.qr.empty")}</p>`}
        </div>
        <div class="form-row" style="margin-top:12px">
          <label for="qr-file">${t("settings.qr.choose")}</label>
          <input id="qr-file" type="file" accept="image/png,image/jpeg,image/webp" />
        </div>
        <button class="primary" id="qr-save" disabled>${cur ? t("settings.qr.replace") : t("settings.qr.save")}</button>
        ${cur ? `<button class="secondary" id="qr-clear" style="margin-top:8px;width:100%">${t("settings.qr.delete")}</button>` : ""}
        <div id="qr-err" class="error" style="display:none"></div>
        <div id="qr-ok" class="success" style="display:none"></div>
      </div>
    </div>
  `;

  const fileInput = document.getElementById("qr-file");
  const saveBtn = document.getElementById("qr-save");
  let pendingFile = null;

  fileInput.onchange = () => {
    const f = fileInput.files && fileInput.files[0];
    pendingFile = null;
    document.getElementById("qr-err").style.display = "none";
    if (!f) {
      saveBtn.disabled = true;
      return;
    }
    if (f.size > 1024 * 1024 * 2) {
      const err = document.getElementById("qr-err");
      err.textContent = t("settings.qr.too_large");
      err.style.display = "block";
      saveBtn.disabled = true;
      return;
    }
    pendingFile = f;
    saveBtn.disabled = false;
  };

  saveBtn.onclick = async () => {
    if (!pendingFile) return;
    saveBtn.disabled = true;
    document.getElementById("qr-err").style.display = "none";
    document.getElementById("qr-ok").style.display = "none";
    try {
      await api.uploadMyQr(pendingFile);
      const okBox = document.getElementById("qr-ok");
      okBox.textContent = t("settings.qr.saved");
      okBox.style.display = "block";
      // Re-render — подтянет URL нового файла и обновит preview/кнопки.
      setTimeout(() => renderPaymentsTab(app), 500);
    } catch (e) {
      const err = document.getElementById("qr-err");
      err.textContent = t("app.error", { msg: e.message });
      err.style.display = "block";
      saveBtn.disabled = false;
    }
  };

  const clearBtn = document.getElementById("qr-clear");
  if (clearBtn) {
    clearBtn.onclick = async () => {
      if (!confirm(t("settings.qr.delete_confirm"))) return;
      try {
        await api.deleteMyQr();
        renderPaymentsTab(app);
      } catch (e) {
        const err = document.getElementById("qr-err");
        err.textContent = t("app.error", { msg: e.message });
        err.style.display = "block";
      }
    };
  }
}
