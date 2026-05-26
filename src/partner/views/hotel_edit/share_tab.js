// Share tab — три share-ссылки (web/tg-start/tg-startapp) с copy-кнопками.

import { t } from "../../../i18n.js";

import { state } from "./index.js";

export function renderShareTab(body) {
  const h = state.hotel;
  body.innerHTML = `
    <div class="form-row">
      <label>${t("hotel.share.web")}</label>
      <input id="share-web" readonly value="https://book.dev.raftforge.art/?hotel=${h.slug}" />
    </div>
    <div class="form-row">
      <label>${t("hotel.share.tg_start")}</label>
      <input id="share-tg-start" readonly value="https://t.me/rforge_stay_bot?start=hotel_${h.slug}" />
    </div>
    <div class="form-row">
      <label>${t("hotel.share.tg_startapp")}</label>
      <input id="share-tg-app" readonly value="https://t.me/rforge_stay_bot?startapp=hotel_${h.slug}" />
    </div>
    <div class="row-actions">
      <button class="secondary" id="btn-copy-web">${t("hotel.share.copy_web")}</button>
      <button class="secondary" id="btn-copy-tg-start">${t("hotel.share.copy_tg_start")}</button>
      <button class="secondary" id="btn-copy-tg-app">${t("hotel.share.copy_tg_startapp")}</button>
    </div>
    <div id="copy-toast" class="success" style="display:none">${t("hotel.share.copied")}</div>
  `;
  const copyTo = (selector) => {
    const el = document.querySelector(selector);
    el.select();
    navigator.clipboard?.writeText(el.value).catch(() => document.execCommand("copy"));
    const toast = document.getElementById("copy-toast");
    toast.style.display = "block";
    setTimeout(() => (toast.style.display = "none"), 1500);
  };
  document.getElementById("btn-copy-web").onclick = () => copyTo("#share-web");
  document.getElementById("btn-copy-tg-start").onclick = () => copyTo("#share-tg-start");
  document.getElementById("btn-copy-tg-app").onclick = () => copyTo("#share-tg-app");
}
