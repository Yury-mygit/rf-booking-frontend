// Client block entry: parses `params.rest` (часть пути после /client/) и
// диспатчит на соответствующий view.
//
// Важно: showBack регистрируем СРАЗУ при матче роута, до await внутри view.
// Иначе TG BackButton остаётся скрытым (router.run сделал hideBack) пока
// view ждёт api, и tap по back в этом окне закрывает WebApp штатно.

import "../styles/client.css";

import { t } from "../i18n.js";
import { navigate } from "../router.js";
import { setTitle, showBack } from "../topbar.js";

import {
  renderHotelDetail,
  renderHotelRooms,
  renderHotelServices,
  renderHotelBookConfirm,
  renderHotelMap,
} from "./views/hotel/index.js";
import { renderHotels } from "./views/hotels.js";
import { renderBookings } from "./views/bookings.js";
import { renderChatThread } from "./views/chat/thread.js";
import { renderPay } from "./views/pay.js";
import { renderClientLogin } from "./views/login.js";

// rest:
//   /hotel/<slug>              → Отель (фото+описание)
//   /hotel/<slug>/rooms        → Комнаты
//   /hotel/<slug>/services     → Услуги отеля
//   /hotel/<slug>/book/<room>  → Забронировать (форма подтверждения)
//   /hotel/<slug>/map          → Карта
//   /hotels                    → список всех отелей
//   /bookings                  → мои брони
//   /pay/<code>                → оплата
//   /login                     → dev-логин
const ROUTES = [
  { re: /^\/hotel\/([^/]+)\/map$/, handler: (m) => renderHotelMap({ id: decodeURIComponent(m[1]) }) },
  { re: /^\/hotel\/([^/]+)\/rooms$/, handler: (m) => renderHotelRooms({ id: decodeURIComponent(m[1]) }) },
  { re: /^\/hotel\/([^/]+)\/services$/, handler: (m) => renderHotelServices({ id: decodeURIComponent(m[1]) }) },
  { re: /^\/hotel\/([^/]+)\/book\/([^/]+)$/, handler: (m) => renderHotelBookConfirm({ id: decodeURIComponent(m[1]), roomId: decodeURIComponent(m[2]) }) },
  { re: /^\/hotel\/([^/]+)$/, handler: (m) => renderHotelDetail({ id: decodeURIComponent(m[1]) }) },
  { re: /^\/bookings$/, handler: () => renderBookings() },
  { re: /^\/hotels$/, handler: () => renderHotels() },
  { re: /^\/chat\/thread\/(\d+)$/, handler: (m) => renderChatThread({ threadId: m[1] }) },
  { re: /^\/pay\/([^/]+)$/, handler: (m) => renderPay({ code: decodeURIComponent(m[1]) }) },
  { re: /^\/login$/, handler: () => renderClientLogin() },
];

// parentPath: куда вести «назад» из текущего client-пути. null — в hub (#/).
function parentPath(rest) {
  let m;
  if ((m = rest.match(/^\/hotel\/([^/]+)\/(map|rooms|services)$/))) return `/client/hotel/${m[1]}`;
  if ((m = rest.match(/^\/hotel\/([^/]+)\/book\/[^/]+$/))) return `/client/hotel/${m[1]}/rooms`;
  if (rest.match(/^\/chat\/thread\/\d+$/)) return null; // back через history
  return null;
}

function syncTopChrome(rest) {
  const parent = parentPath(rest);
  if (parent === null) showBack(() => navigate("#/"));
  else showBack(() => navigate("#" + parent));
}

export async function render(params) {
  document.body.dataset.block = "client";
  const rest = params.rest || "/";

  for (const { re, handler } of ROUTES) {
    const m = rest.match(re);
    if (m) {
      syncTopChrome(rest);
      await handler(m);
      return;
    }
  }

  // Корень /client/ или неизвестный путь — заглушка с возвратом в hub.
  setTitle(t("client.app_name"));
  showBack(() => navigate("#/"));
  document.getElementById("app").innerHTML =
    `<p class="hint">${t("client.no_hotel", { bot: "@rforge_stay_bot" })}</p>`;
}
