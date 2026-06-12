// Лёгкий toast-помощник. В TG WebApp использует нативный showAlert
// (модальный диалог, блокирующий до OK). Вне TG — fixed-div снизу с
// автоскрытием через 2.5s. Используется для UX-ошибок типа «выберите
// даты прежде чем бронировать».

import { inTelegram, tg } from "../tg.js";

export function showToast(msg) {
  if (inTelegram && typeof tg?.showAlert === "function") {
    try {
      tg.showAlert(msg);
      return;
    } catch {
      // fallthrough to inline
    }
  }
  let el = document.getElementById("app-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "app-toast";
    el.className = "app-toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  if (el._hideTimer) clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => el.classList.remove("show"), 2500);
}
