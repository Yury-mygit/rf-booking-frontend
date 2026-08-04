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

// Лёгкая подсказка — всегда inline, не использует tg.showAlert.
// Для коротких meta-сообщений типа «название amenity по тапу на иконку»,
// где модальный диалог был бы излишне навязчив.
export function showHint(msg) {
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
  el._hideTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

// Немодальный feedback для коротких результатов form-actions. В отличие от
// showToast() никогда не вызывает tg.showAlert: сообщение само исчезает и не
// блокирует Telegram WebApp. Повторный вызов переиспользует node и timer.
export function showFloatingToast(message, { variant = "success", duration } = {}) {
  let el = document.getElementById("app-floating-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "app-floating-toast";
    el.className = "app-floating-toast";
    document.body.appendChild(el);
  }

  const resolvedVariant = variant === "error" ? "error" : "success";
  el.className = `app-floating-toast ${resolvedVariant}`;
  el.setAttribute("role", resolvedVariant === "error" ? "alert" : "status");
  el.setAttribute("aria-live", resolvedVariant === "error" ? "assertive" : "polite");
  el.textContent = message;

  // Force a frame between resetting the class and showing it so a toast that
  // replaces an already-visible one still restarts its transition and timer.
  requestAnimationFrame(() => el.classList.add("show"));
  if (el._hideTimer) clearTimeout(el._hideTimer);
  const timeout = duration ?? (resolvedVariant === "error" ? 3000 : 1800);
  el._hideTimer = setTimeout(() => el.classList.remove("show"), timeout);
}
