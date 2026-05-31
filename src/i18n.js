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

// Plural-aware translate: подбирает суффикс _one/_few/_many по правилам CLDR
// (русский). Для kygyz/english падает в _one (одна форма в реальных строках).
// Используй базовый ключ без суффикса, напр. tn("hotel.guests", n) →
// hotel.guests_one / _few / _many.
export function tn(baseKey, n, vars = {}) {
  const suffix = pluralSuffix(lang, n);
  return t(`${baseKey}_${suffix}`, { ...vars, n });
}

function pluralSuffix(lng, n) {
  if (lng !== "ru") return "one";
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 14) return "many";
  if (mod10 === 1) return "one";
  if (mod10 >= 2 && mod10 <= 4) return "few";
  return "many";
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
