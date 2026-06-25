// TriStateCheckbox — button с тремя состояниями: inherit / on / off.
// Карта #135 Stage 6.1.
//
// Состояния (data-state):
//   "inherit" — наследует из union ролей (NULL в backend). Визуально серый.
//   "on"      — explicit override true. Яркий ✓.
//   "off"     — explicit override false. Яркий ✗.
//
// Клик циклит inherit → on → off → inherit.

import { t } from "../../../i18n.js";

const NEXT = { inherit: "on", on: "off", off: "inherit" };
const GLYPH = { inherit: "·", on: "✓", off: "✗" };

function stateFromValue(v) {
  if (v === true) return "on";
  if (v === false) return "off";
  return "inherit";
}

function valueFromState(s) {
  if (s === "on") return true;
  if (s === "off") return false;
  return null;
}

// HTML строка для вставки в шаблон. `name` пойдёт в data-perm для get/set.
export function triStateHtml(name, value, effective) {
  const state = stateFromValue(value);
  return `<button type="button" class="tristate" data-perm="${name}" data-state="${state}" data-effective="${effective ? 1 : 0}"
    aria-checked="${state === "on" ? "true" : state === "off" ? "false" : "mixed"}"
    title="${t("perms.tristate_" + state)}">
    <span class="tristate-glyph">${GLYPH[state]}</span>
  </button>`;
}

// Привязать обработчик клика к контейнеру (event delegation).
// onChange(name, newValue) вызывается после переключения.
export function wireTriState(container, onChange) {
  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".tristate");
    if (!btn) return;
    const cur = btn.dataset.state;
    const next = NEXT[cur];
    btn.dataset.state = next;
    btn.querySelector(".tristate-glyph").textContent = GLYPH[next];
    btn.setAttribute("aria-checked", next === "on" ? "true" : next === "off" ? "false" : "mixed");
    btn.title = t("perms.tristate_" + next);
    if (onChange) onChange(btn.dataset.perm, valueFromState(next));
  });
}

// Прочитать текущее tri-state значение из всех кнопок контейнера.
// Возвращает {permName: bool|null, ...}.
export function readTriState(container) {
  const out = {};
  container.querySelectorAll(".tristate").forEach((btn) => {
    out[btn.dataset.perm] = valueFromState(btn.dataset.state);
  });
  return out;
}
