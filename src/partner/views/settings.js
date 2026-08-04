// Partner settings — QR-код отельера. QR — per-user endpoint /api/v1/me/qr;
// owner отеля загружает свой QR-код, клиенты видят его при оплате.

import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { setTitle, showBack } from "../../topbar.js";
import { setBottomNav } from "../../bottomnav.js";
import { settingsReturnToPrevious } from "../../settings_shared.js";

export function renderPartnerSettings() {
  setTitle(t("settings.title"));
  showBack(settingsReturnToPrevious);
  setBottomNav([]);
  renderPaymentsTab(document.getElementById("app"));
}

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
