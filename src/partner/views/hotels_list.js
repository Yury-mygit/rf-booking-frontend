import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { assetThumbUrl, escapeHtml } from "../../util.js";

const createBarHtml = () =>
  `<div class="create-bar"><button class="primary" id="hotels-create-btn">${t("hotels.new")}</button></div>`;

// body.has-create-bar держит padding-bottom на main#app, чтобы
// последняя карточка не уходила под fixed-bar. Снимаем при уходе
// с /partner root — иначе соседние partner-view получают лишний отступ.
window.addEventListener("hashchange", () => {
  const hash = location.hash.replace(/^#/, "").split("?")[0];
  if (!/^\/partner\/?$/.test(hash)) {
    document.body.classList.remove("has-create-bar");
  }
});

function cardHtml(h) {
  const photo = (h.photos && h.photos[0]) || "";
  const thumb = assetThumbUrl(photo);
  const photoHtml = thumb
    ? `<div class="hotel-thumb" style="background-image:url('${escapeHtml(thumb)}')"></div>`
    : `<div class="hotel-thumb hotel-thumb-empty"></div>`;
  return `
    <div class="card hotel-row clickable-card" data-href="#/partner/hotel/${h.id}" role="link" tabindex="0">
      ${photoHtml}
      <div class="hotel-row-body">
        <h3>${escapeHtml(h.name_ru)}</h3>
        <div class="meta">${escapeHtml(h.city)}${h.address ? " · " + escapeHtml(h.address) : ""}</div>
        <span class="status-pill ${h.status}">${t("hotels.status." + h.status)}</span>
      </div>
      <div class="hotel-actions">
        <a class="hotel-edit-btn" href="#/partner/hotel/${h.id}/rooms" title="${t("hotels.rooms_btn")}" aria-label="${t("hotels.rooms_btn")}">🛏</a>
      </div>
    </div>`;
}

function attachCardHandlers(container) {
  container.addEventListener("click", (e) => {
    if (e.target.closest("a, button")) return;
    const card = e.target.closest(".clickable-card");
    if (!card) return;
    const href = card.dataset.href;
    if (href) location.hash = href;
  });
  container.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".clickable-card");
    if (!card) return;
    e.preventDefault();
    location.hash = card.dataset.href;
  });
}

export async function renderHotelsList() {
  const app = document.getElementById("app");
  // Only the owner-self can create hotels — staff cannot.
  const activeOwnerId = api.activeOwnerId();
  const owner = api.owners().find((o) => o.owner_user_id === activeOwnerId);
  const isSelf = !!(owner && owner.is_self);
  if (isSelf) document.body.classList.add("has-create-bar");
  else document.body.classList.remove("has-create-bar");
  app.innerHTML = `<div id="list">${t("common.loading")}</div>
    ${isSelf ? createBarHtml() : ""}`;
  if (isSelf) {
    document.getElementById("hotels-create-btn").addEventListener("click", () => {
      location.hash = "#/partner/hotel/new";
    });
  }
  try {
    const hotels = await api.listHotels();
    const list = document.getElementById("list");
    if (!hotels.length) {
      list.innerHTML = `<p class="muted">${t("hotels.empty")}</p>`;
      return;
    }
    list.innerHTML = hotels.map(cardHtml).join("");
    attachCardHandlers(list);
  } catch (e) {
    document.getElementById("list").innerHTML =
      `<div class="error">${t("common.error", { msg: e.message })}</div>`;
  }
}
