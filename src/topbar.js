// Topbar API для views: setTitle(), showBack(onclick), hideBack().
// router.run() сбрасывает back перед каждой view; view сама её включает
// если нужно.

const elBack = () => document.getElementById("topbar-back");
const elTitle = () => document.getElementById("topbar-title");

export function setTitle(text) {
  const el = elTitle();
  if (el) el.textContent = text || "";
}

export function showBack(onclick) {
  const b = elBack();
  if (!b) return;
  b.hidden = false;
  b.onclick = onclick;
}

export function hideBack() {
  const b = elBack();
  if (b) b.hidden = true;
}

export function initTopbar() {
  // Резерв под future-фичи (например, кнопка-меню, owner-pill).
}
