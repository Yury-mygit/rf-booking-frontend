// Общий i18n словарь с namespacing: common.*, entry.*, client.*, partner.*,
// admin.*. Ключи из старых 4 локалей переезжают сюда — конфликты по `app.*`
// (loading/error/back/cancel) убраны в `common.*`.

import ru from "../locales/ru.json";
import ky from "../locales/ky.json";
import en from "../locales/en.json";

const dicts = { ru, ky, en };
export const LANG_ORDER = ["ru", "ky", "en"];

let lang = localStorage.getItem("rfbook_lang") || "ru";

export function t(key, vars = {}) {
  const tmpl = dicts[lang][key] ?? dicts.ru[key] ?? key;
  return tmpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ""));
}

export function getLang() {
  return lang;
}

export function setLang(l) {
  if (!dicts[l]) return;
  lang = l;
  localStorage.setItem("rfbook_lang", l);
  window.dispatchEvent(new CustomEvent("langchange"));
}

export function cycleLang() {
  const i = LANG_ORDER.indexOf(lang);
  setLang(LANG_ORDER[(i + 1) % LANG_ORDER.length]);
}

export function applyStaticI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  const btn = document.getElementById("lang-cycle");
  if (btn) btn.textContent = lang.toUpperCase();
}
