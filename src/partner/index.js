// Partner block entry. Парсит `params.rest` (часть после /partner/), диспатчит
// на view, монтирует owner-selector + bottom-nav. Pending-screen — отдельно,
// поверх всех роутов.

import "../styles/partner.css";

import { api } from "../api.js";
import { t } from "../i18n.js";
import { navigate } from "../router.js";
import { setTitle, showBack } from "../topbar.js";
import { inTelegram, tg } from "../tg.js";
import { mountOwnerSelector } from "./owner_selector.js";
import { renderMainNav, activeNavKey, setBottomNav } from "./nav.js";

import { renderPending } from "./views/pending.js";
import { renderPartnerLogin } from "./views/login.js";
import { renderHotelsList } from "./views/hotels_list.js";
import { renderAllRooms } from "./views/all_rooms.js";
import { renderBookings } from "./views/bookings.js";
import { renderClientsList } from "./views/clients_list.js";
import { renderClientEdit } from "./views/client_edit.js";
import { renderHotelEdit } from "./views/hotel_edit/index.js";
import { renderRoomsList } from "./views/rooms_list.js";
import { renderRoomEdit } from "./views/room_edit.js";
import { renderAvailability } from "./views/availability.js";
import { renderStaffList } from "./views/staff_list/index.js";
import { renderAudit } from "./views/audit.js";

// rest paths: "/", "/rooms", "/bookings", "/clients", "/client/{id}",
//   "/hotel/{id}", "/hotel/{id}/rooms", "/room/{hid}/{rid}",
//   "/room/{hid}/{rid}/availability", "/staff", "/audit", "/login"
const ROUTES = [
  { re: /^\/?$/, h: (_m) => renderHotelsList(), titleKey: "pageTitle.hotels" },
  { re: /^\/login$/, h: () => renderPartnerLogin(), titleKey: "pageTitle.devLogin" },
  { re: /^\/rooms$/, h: () => renderAllRooms(), titleKey: "pageTitle.rooms" },
  { re: /^\/bookings$/, h: () => renderBookings(), titleKey: "pageTitle.bookings" },
  { re: /^\/clients$/, h: () => renderClientsList(), titleKey: "pageTitle.clients" },
  { re: /^\/client\/([^/]+)$/, h: (m) => renderClientEdit({ clientId: decodeURIComponent(m[1]) }), titleKey: "pageTitle.clientEdit" },
  { re: /^\/hotel\/([^/]+)\/rooms$/, h: (m) => renderRoomsList({ hotelId: decodeURIComponent(m[1]) }), titleKey: "pageTitle.hotelRooms" },
  { re: /^\/hotel\/([^/]+)$/, h: (m) => renderHotelEdit({ id: decodeURIComponent(m[1]) }), titleKey: "pageTitle.hotelEdit" },
  { re: /^\/room\/([^/]+)\/([^/]+)\/availability$/, h: (m) => renderAvailability({ hotelId: decodeURIComponent(m[1]), roomId: decodeURIComponent(m[2]) }), titleKey: "pageTitle.availability" },
  { re: /^\/room\/([^/]+)\/([^/]+)$/, h: (m) => renderRoomEdit({ hotelId: decodeURIComponent(m[1]), roomId: decodeURIComponent(m[2]) }), titleKey: "pageTitle.roomEdit" },
  { re: /^\/staff$/, h: () => renderStaffList(), titleKey: "pageTitle.staff" },
  { re: /^\/audit$/, h: () => renderAudit(), titleKey: "pageTitle.audit" },
];

// parentPath: куда вести «назад» из текущего partner-пути.
// null — вернуться в hub (#/). Иначе вернёт partner-абсолютный путь без `#`.
const ROOT_PATHS = new Set(["/", "", "/rooms", "/bookings", "/clients", "/staff"]);

export function parentPath(rest) {
  if (ROOT_PATHS.has(rest)) return null;
  let m;
  if ((m = rest.match(/^\/hotel\/([^/]+)\/rooms$/))) return `/partner/hotel/${m[1]}`;
  if ((m = rest.match(/^\/room\/([^/]+)\/([^/]+)\/availability$/))) return `/partner/room/${m[1]}/${m[2]}`;
  if ((m = rest.match(/^\/room\/([^/]+)\/([^/]+)$/))) return `/partner/hotel/${m[1]}/rooms`;
  if (rest.startsWith("/hotel/")) return "/partner/";
  if (rest.startsWith("/client/")) return "/partner/clients";
  if (rest === "/audit") return "/partner/staff";
  return "/partner/";
}

let _pendingArmed = false;
function armPendingListener() {
  if (_pendingArmed) return;
  _pendingArmed = true;
  window.addEventListener("apierror", (e) => {
    if (e.detail && e.detail.code === "partner_pending") {
      const u = api.user() || {};
      u.partner_status = "pending";
      api.setSession(api.authToken(), u);
      renderPending();
    }
  });
}

function syncTopChrome(rest) {
  mountOwnerSelector();
  renderMainNav(activeNavKey(rest));
  const parent = parentPath(rest);
  if (parent === null) showBack(() => navigate("#/"));
  else showBack(() => navigate("#" + parent));
}

async function refreshWhoami() {
  try {
    const w = await api.whoami();
    api.setSession(api.authToken(), api.user(), w.accessible_owners || []);
  } catch {
    // network/auth — следующий вызов API упадёт со своим кодом.
  }
}

export async function render(params) {
  document.body.dataset.block = "partner";
  armPendingListener();
  const rest = params.rest || "/";

  // 1. Не залогинены — fallback: если нет токена и мы вне TG → dev-login.
  if (!api.hasToken()) {
    if (!inTelegram) {
      setTitle(t("pageTitle.devLogin"));
      showBack(() => navigate("#/"));
      renderPartnerLogin();
      return;
    }
    if (tg && tg.initData) {
      try {
        const r = await api.authTg(tg.initData);
        api.setSession(r.token, r.user, r.accessible_owners);
      } catch (e) {
        document.getElementById("app").innerHTML =
          `<div class="error">${t("common.error", { msg: e.message })}</div>`;
        return;
      }
    } else {
      document.getElementById("app").innerHTML =
        `<p class="muted">${t("app.no_session", { bot: "rforge_stay_bot" })}</p>`;
      return;
    }
  }

  // 2. Pending: партнёр без подтверждения админом.
  const u = api.user();
  if (u && u.partner_status === "pending") {
    setTitle(t("pageTitle.pending"));
    showBack(() => navigate("#/"));
    renderPending();
    return;
  }

  // 3. accessible_owners актуализируем.
  if (api.owners().length === 0) {
    await refreshWhoami();
  } else {
    refreshWhoami();
  }

  // 4. Dispatch.
  for (const { re, h, titleKey } of ROUTES) {
    const m = rest.match(re);
    if (m) {
      if (titleKey) setTitle(t(titleKey));
      syncTopChrome(rest);
      try {
        await h(m);
      } catch (e) {
        console.error("Partner route error:", e);
        document.getElementById("app").innerHTML =
          `<div class="error">${t("common.error", { msg: e.message })}</div>`;
      }
      return;
    }
  }

  setTitle(t("pageTitle.notFound"));
  document.getElementById("app").textContent = "404: /partner" + rest;
}

export { setBottomNav };
