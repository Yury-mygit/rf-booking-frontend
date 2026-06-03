// SupportSettings: auto_close + SLA-часы + auto_greet. Superadmin only.

import "../../../styles/support.css";

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";

import { renderSupportSubNav } from "./_nav.js";

const FIELDS = [
  { k: "auto_close_days", labelKey: "support.settings.auto_close_days" },
  { k: "sla_response_low_h", labelKey: "support.settings.sla_response", suffix: "low" },
  { k: "sla_response_normal_h", labelKey: "support.settings.sla_response", suffix: "normal" },
  { k: "sla_response_high_h", labelKey: "support.settings.sla_response", suffix: "high" },
  { k: "sla_response_urgent_h", labelKey: "support.settings.sla_response", suffix: "urgent" },
  { k: "sla_resolution_low_h", labelKey: "support.settings.sla_resolution", suffix: "low" },
  { k: "sla_resolution_normal_h", labelKey: "support.settings.sla_resolution", suffix: "normal" },
  { k: "sla_resolution_high_h", labelKey: "support.settings.sla_resolution", suffix: "high" },
  { k: "sla_resolution_urgent_h", labelKey: "support.settings.sla_resolution", suffix: "urgent" },
];

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

export async function renderAdminSupportSettings() {
  const root = document.getElementById("app");
  root.innerHTML = `${renderSupportSubNav("settings")}<div class="support-mgmt" id="settings-area">${esc(t("common.loading"))}</div>`;
  const area = document.getElementById("settings-area");

  let s;
  try {
    s = await api.adminGetSettings();
  } catch (e) {
    area.innerHTML = `<div class="error">${esc(e.message)}</div>`;
    return;
  }

  area.innerHTML = `
    <form id="settings-form" class="support-form">
      ${FIELDS.map((f) => `
        <label>${esc(t(f.labelKey))}${f.suffix ? ` · ${esc(t("support.priority." + f.suffix))}` : ""}
          <input type="number" min="1" name="${f.k}" value="${esc(s[f.k])}" required>
        </label>
      `).join("")}
      <label>
        <input type="checkbox" name="auto_greet_enabled"${s.auto_greet_enabled ? " checked" : ""}>
        ${esc(t("support.settings.auto_greet_enabled"))}
      </label>
      <button type="submit">${esc(t("common.confirm"))}</button>
      <div id="settings-status" class="muted"></div>
    </form>
  `;

  document.getElementById("settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {};
    for (const f of FIELDS) body[f.k] = Number(fd.get(f.k));
    body.auto_greet_enabled = fd.get("auto_greet_enabled") === "on";

    const statusEl = document.getElementById("settings-status");
    try {
      await api.adminPatchSettings(body);
      statusEl.textContent = t("support.settings.saved");
      setTimeout(() => { statusEl.textContent = ""; }, 2000);
    } catch (err) {
      alert(t("common.error", { msg: err.message }));
    }
  });
}
