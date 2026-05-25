// Topbar API для views: setTitle(), showBack(onclick), hideBack().
// router.run() сбрасывает back перед каждой view; view сама её включает
// если нужно.
//
// showBack/hideBack дополнительно дёргают TG WebApp BackButton — иначе
// native back (стрелка в шапке TG, аппаратный Back на Android) закрывает
// WebApp вместо возврата к точке выбора Режима.

import { tg } from "./tg.js";

const elBack = () => document.getElementById("topbar-back");
const elTitle = () => document.getElementById("topbar-title");

let _tgBackHandler = null;

function _detachTgBack() {
  if (tg && tg.BackButton && _tgBackHandler) {
    try { tg.BackButton.offClick(_tgBackHandler); } catch (_) {}
  }
  _tgBackHandler = null;
}

export function setTitle(text) {
  const el = elTitle();
  if (el) el.textContent = text || "";
}

export function showBack(onclick) {
  const b = elBack();
  if (b) {
    b.hidden = false;
    b.onclick = onclick;
  }
  // TG native BackButton — пересоздаём подписку, чтобы старый handler
  // не висел поверх нового.
  if (tg && tg.BackButton) {
    _detachTgBack();
    _tgBackHandler = onclick;
    try { tg.BackButton.onClick(_tgBackHandler); } catch (_) {}
    try { tg.BackButton.show(); } catch (_) {}
  }
}

export function hideBack() {
  const b = elBack();
  if (b) b.hidden = true;
  if (tg && tg.BackButton) {
    _detachTgBack();
    try { tg.BackButton.hide(); } catch (_) {}
  }
}

export function initTopbar() {
  // Резерв под future-фичи (например, кнопка-меню, owner-pill).
}
