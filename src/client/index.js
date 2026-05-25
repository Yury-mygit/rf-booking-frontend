// Client block entry: parses `params.rest` (часть пути после /client/) и
// диспатчит на соответствующий view. CSS блока подгружается через `import` —
// vite положит его в общий bundle первого dynamic-импорта блока.
//
// Важно: showBack регистрируем СРАЗУ при матче роута, до await внутри view.
// Иначе TG BackButton остаётся скрытым (router.run сделал hideBack) пока
// view ждёт api, и tap по back в этом окне закрывает WebApp штатно. Partner
// и admin блоки уже сделаны через тот же синхронный showBack-в-диспетчере.

import "../styles/client.css";

import { t } from "../i18n.js";
import { navigate } from "../router.js";
import { setTitle, showBack } from "../topbar.js";

import { renderHotel, renderHotelMap } from "./views/hotel.js";
import { renderPay } from "./views/pay.js";
import { renderClientLogin } from "./views/login.js";

// rest: "/hotel/<slug>", "/hotel/<slug>/map", "/pay/<code>", "/login", "" или "/"
const ROUTES = [
  { re: /^\/hotel\/([^/]+)\/map$/, handler: (m) => renderHotelMap({ id: decodeURIComponent(m[1]) }) },
  { re: /^\/hotel\/([^/]+)$/, handler: (m) => renderHotel({ id: decodeURIComponent(m[1]) }) },
  { re: /^\/pay\/([^/]+)$/, handler: (m) => renderPay({ code: decodeURIComponent(m[1]) }) },
  { re: /^\/login$/, handler: () => renderClientLogin() },
];

// parentPath: куда вести «назад» из текущего client-пути. null — в hub (#/).
// view может переопределить showBack после загрузки данных (например, pay
// после получения booking меняет back на конкретный hotel-slug).
function parentPath(rest) {
  let m;
  if ((m = rest.match(/^\/hotel\/([^/]+)\/map$/))) return `/client/hotel/${m[1]}`;
  return null; // /hotel/X, /pay/X, /login, / — все возвращают в hub
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
