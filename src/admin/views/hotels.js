import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { escapeHtml } from "../../util.js";

export async function renderHotels() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="filter-row">
      <div>
        <label>${t("hotels.filter.status")}</label>
        <select id="f-st">
          <option value="">${t("hotels.filter.status_any")}</option>
          <option value="draft">${t("hotels.status.draft")}</option>
          <option value="published">${t("hotels.status.published")}</option>
          <option value="blocked">${t("hotels.status.blocked")}</option>
        </select>
      </div>
    </div>
    <div id="list">${t("app.loading")}</div>`;
  document.getElementById("f-st").onchange = load;
  load();
}

async function load() {
  const st = document.getElementById("f-st").value;
  const list = document.getElementById("list");
  list.innerHTML = t("app.loading");
  try {
    const hotels = await api.adminListHotels(st);
    if (!hotels.length) {
      list.innerHTML = `<p class="muted">${t("hotels.empty")}</p>`;
      return;
    }
    list.innerHTML = hotels
      .map(
        (h) => `
        <div class="card">
          <div><b>${escapeHtml(h.name_ru)}</b>
            <span class="status-pill ${h.status}">${t("hotels.status." + h.status)}</span></div>
          <div class="meta">${escapeHtml(h.city)} · hid=${h.id}</div>
          <div class="meta">${t("hotels.owner", { name: escapeHtml(h.owner_first_name || "—"), uid: h.owner_user_id })}</div>
          <div class="row-actions">
            ${["draft", "published", "blocked"]
              .filter((s) => s !== h.status)
              .map(
                (s) =>
                  `<button class="secondary" data-set="${h.id}:${s}">→ ${t("hotels.status." + s)}</button>`,
              )
              .join("")}
          </div>
        </div>`,
      )
      .join("");
    list.querySelectorAll("[data-set]").forEach((b) => {
      b.onclick = async () => {
        const [id, s] = b.dataset.set.split(":");
        try {
          await api.adminSetHotelStatus(id, s);
          load();
        } catch (e) { alert(e.message); }
      };
    });
  } catch (e) {
    list.innerHTML = `<div class="error">${t("app.error", { msg: e.message })}</div>`;
  }
}
