// Settings view — общий для всех блоков. Открывается из шестерёнки в
// topbar (#settings-btn) через openSettings(); back возвращает на тот
// hash, с которого пришли.
//
// 2 таба в bottomnav: «Общие» (язык) / «Платежи» (QR-код).
// QR хранится в localStorage как base64 — для прод нужен backend-endpoint
// (см. follow-up). Достаточно для single-device теста.

import { t, LANG_ORDER, getLang, setLang } from "./i18n.js";
import { navigate } from "./router.js";
import { setTitle, showBack } from "./topbar.js";
import { setBottomNav } from "./bottomnav.js";

const QR_KEY = "rfbook_payment_qr";

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

function render() {
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

// ─── Таб «Платежи» — QR-код ─────────────────────────────────────────────────

function getQR() {
  return localStorage.getItem(QR_KEY);
}

function renderPaymentsTab(app) {
  const cur = getQR();
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
        <p class="muted" style="margin-top:12px;font-size:11px">${t("settings.qr.hint")}</p>
      </div>
    </div>
  `;

  const fileInput = document.getElementById("qr-file");
  const saveBtn = document.getElementById("qr-save");
  let pendingB64 = null;

  fileInput.onchange = async () => {
    const f = fileInput.files && fileInput.files[0];
    pendingB64 = null;
    document.getElementById("qr-err").style.display = "none";
    if (!f) {
      saveBtn.disabled = true;
      return;
    }
    if (f.size > 1024 * 1024 * 2) {
      document.getElementById("qr-err").textContent = t("settings.qr.too_large");
      document.getElementById("qr-err").style.display = "block";
      saveBtn.disabled = true;
      return;
    }
    try {
      pendingB64 = await readAsDataURL(f);
      saveBtn.disabled = false;
    } catch (e) {
      document.getElementById("qr-err").textContent = t("app.error", { msg: e.message });
      document.getElementById("qr-err").style.display = "block";
    }
  };

  saveBtn.onclick = () => {
    if (!pendingB64) return;
    try {
      localStorage.setItem(QR_KEY, pendingB64);
      const okBox = document.getElementById("qr-ok");
      okBox.textContent = t("settings.qr.saved");
      okBox.style.display = "block";
      // Re-render для отображения preview с новой картинкой
      setTimeout(() => renderPaymentsTab(app), 500);
    } catch (e) {
      // localStorage quota / SecurityError
      document.getElementById("qr-err").textContent = t("app.error", { msg: e.message });
      document.getElementById("qr-err").style.display = "block";
    }
  };

  const clearBtn = document.getElementById("qr-clear");
  if (clearBtn) {
    clearBtn.onclick = () => {
      if (!confirm(t("settings.qr.delete_confirm"))) return;
      localStorage.removeItem(QR_KEY);
      renderPaymentsTab(app);
    };
  }
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}
