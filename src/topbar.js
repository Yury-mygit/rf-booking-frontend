// Topbar API для views: setTitle(), showBack(onclick), hideBack().
//
// Кнопка back в нашей шапке снесена — back-функционал полностью через
// TG WebApp BackButton (стрелка в TG-нативной шапке + аппаратный back).
// showBack/hideBack теперь управляют только tg.BackButton.

import { tg } from "./tg.js";

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
  if (!tg || !tg.BackButton) return;
  _detachTgBack();
  _tgBackHandler = onclick;
  try { tg.BackButton.onClick(_tgBackHandler); } catch (_) {}
  try { tg.BackButton.show(); } catch (_) {}
}

export function hideBack() {
  if (!tg || !tg.BackButton) return;
  _detachTgBack();
  try { tg.BackButton.hide(); } catch (_) {}
}

export function initTopbar() {
  // Резерв под future-фичи (например, кнопка-меню).
}
