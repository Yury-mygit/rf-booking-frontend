// Shared helpers для блочных settings-views.
//
// - openSettingsDispatch(): вызывается по клику #settings-btn (main.js).
//   Читает body.dataset.block, запоминает current hash и переводит на
//   partner settings URL через history.replaceState —
//   settings НЕ попадает в history, TG-Back возвращает на предыдущий view.
// - settingsReturnToPrevious(): back-handler блочных форм; отматывает
//   на сохранённый hash через replaceState + run().
import { run } from "./router.js";

const BLOCK_TO_TARGET = {
  partner: "#/partner/settings",
};

let _returnHash = "#/";

export function openSettingsDispatch() {
  const cur = (location.hash || "#/").split("?")[0];
  const target = BLOCK_TO_TARGET[document.body.dataset.block];
  if (!target) return;
  if (cur === target) return;
  _returnHash = location.hash || "#/";
  history.replaceState(null, "", target);
  run();
}

export function settingsReturnToPrevious() {
  const target = _returnHash || "#/";
  if (location.hash === target) return;
  history.replaceState(null, "", target);
  run();
}
