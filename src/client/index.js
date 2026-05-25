// Client block entry: parses `params.rest` (часть пути после /client/) и
// диспатчит на соответствующий view. CSS блока подгружается через `import` —
// vite положит его в общий bundle первого dynamic-импорта блока.

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

export async function render(params) {
  const rest = params.rest || "/";

  for (const { re, handler } of ROUTES) {
    const m = rest.match(re);
    if (m) {
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
