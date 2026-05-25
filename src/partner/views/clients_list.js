import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { escapeHtml } from "../../util.js";

export async function renderClientsList() {
  const app = document.getElementById("app");
  app.innerHTML = `<div id="list">${t("app.loading")}</div>`;
  try {
    const clients = await api.listClients();
    const list = document.getElementById("list");
    if (!clients.length) {
      list.innerHTML = `<p class="muted">${t("clients.empty")}</p>`;
      return;
    }
    list.innerHTML = clients.map(cardHtml).join("");
    attachCardHandlers(list);
  } catch (e) {
    document.getElementById("list").innerHTML =
      `<div class="error">${t("app.error", { msg: e.message })}</div>`;
  }
}

function cardHtml(c) {
  const photo = c.photo_url
    ? `<div class="hotel-thumb" style="background-image:url('${escapeHtml(c.photo_url)}')"></div>`
    : `<div class="hotel-thumb hotel-thumb-empty"></div>`;
  const name = [c.first_name, c.last_name].filter(Boolean).map(escapeHtml).join(" ");
  const contact = c.phone || c.email || t("clients.no_phone");
  return `
    <div class="card hotel-row clickable-card" data-href="#/partner/client/${c.id}" role="link" tabindex="0">
      ${photo}
      <div class="hotel-row-body">
        <h3>${name}</h3>
        <div class="meta">${escapeHtml(contact)}</div>
        <div class="meta small">${t("clients.bookings_count", { n: c.bookings_count })}${c.last_booking_date ? " · " + t("clients.last_booking", { date: c.last_booking_date }) : ""}</div>
      </div>
    </div>`;
}

function attachCardHandlers(container) {
  container.addEventListener("click", (e) => {
    if (e.target.closest("a, button")) return;
    const card = e.target.closest(".clickable-card");
    if (!card) return;
    location.hash = card.dataset.href;
  });
  container.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".clickable-card");
    if (!card) return;
    e.preventDefault();
    location.hash = card.dataset.href;
  });
}
