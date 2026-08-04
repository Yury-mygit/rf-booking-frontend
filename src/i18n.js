// Общий i18n словарь с namespacing: common.*, entry.*, client.*, partner.*,
// admin.*. Ключи из старых 4 локалей переезжают сюда — конфликты по `app.*`
// (loading/error/back/cancel) убраны в `common.*`.

import ru from "../locales/ru.json";

export const LANG_ORDER = ["ru"];

export function t(key, vars = {}) {
  const tmpl = ru[key] ?? key;
  return tmpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ""));
}

// Plural-aware translate: подбирает суффикс _one/_few/_many по правилам CLDR
// (русский). Для kygyz/english падает в _one (одна форма в реальных строках).
// Используй базовый ключ без суффикса, напр. tn("hotel.guests", n) →
// hotel.guests_one / _few / _many.
export function tn(baseKey, n, vars = {}) {
  const suffix = pluralSuffix(n);
  return t(`${baseKey}_${suffix}`, { ...vars, n });
}

function pluralSuffix(n) {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 14) return "many";
  if (mod10 === 1) return "one";
  if (mod10 >= 2 && mod10 <= 4) return "few";
  return "many";
}

export function getLang() {
  return "ru";
}

export function applyStaticI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
}
