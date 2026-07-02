// Share tab — три share-ссылки (web/tg-start/tg-startapp) с copy-кнопками
// + кнопка «Отправить себе в бот» (self-share deep-link через backend).

import { api } from "../../../api.js";
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
    <div class="row-actions">
      <button class="primary" id="btn-share-self">${t("hotel.share.self_send")}</button>
    </div>
    <div id="copy-toast" class="success" style="display:none">${t("hotel.share.copied")}</div>
    <div id="share-error" class="error" style="display:none"></div>
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

  const errBox = document.getElementById("share-error");
  const showError = (msg) => {
    errBox.textContent = msg;
    errBox.style.display = "block";
  };
  document.getElementById("btn-share-self").onclick = async () => {
    errBox.style.display = "none";
    const btn = document.getElementById("btn-share-self");
    btn.disabled = true;
    try {
      await api.shareHotelToSelf(h.id);
      window.Telegram?.WebApp?.close?.();
    } catch (err) {
      btn.disabled = false;
      if (err.status === 409) {
        showError(t("hotel.share.self_send_hint_start"));
      } else {
        showError(t("hotel.share.self_send_error"));
      }
    }
  };
}
