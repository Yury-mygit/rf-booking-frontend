// Lightbox — оверлей на весь экран для просмотра одной коллекции фото
// со свайпом prev/next. Без pinch-zoom (v1). Закрытие — tap по фону /
// кнопка ✕ / Esc.
//
// API: openLightbox(photos, startIndex, opts), где photos — массив
// URL-строк (или объектов; см. mediaUrl helper). Возвращает функцию
// закрытия. opts.onAfterClose — колбэк после закрытия (для caller'а:
// восстановить showBack callback view).

import { mediaUrl } from "./media_url.js";

let _instance = null;

export function openLightbox(photos, startIndex = 0, opts = {}) {
  if (!photos || photos.length === 0) return () => {};
  if (_instance) _instance.close();

  let idx = Math.max(0, Math.min(startIndex, photos.length - 1));

  const overlay = document.createElement("div");
  overlay.className = "lightbox-overlay";
  overlay.innerHTML = `
    <button type="button" class="lightbox-close" aria-label="Close">×</button>
    <button type="button" class="lightbox-nav lightbox-nav--prev" aria-label="Previous">‹</button>
    <img class="lightbox-img" alt="" />
    <button type="button" class="lightbox-nav lightbox-nav--next" aria-label="Next">›</button>
    <div class="lightbox-counter"></div>
  `;
  document.body.appendChild(overlay);

  const img = overlay.querySelector(".lightbox-img");
  const counter = overlay.querySelector(".lightbox-counter");
  const prevBtn = overlay.querySelector(".lightbox-nav--prev");
  const nextBtn = overlay.querySelector(".lightbox-nav--next");
  const closeBtn = overlay.querySelector(".lightbox-close");

  function render() {
    img.src = mediaUrl(photos[idx]);
    counter.textContent = `${idx + 1} / ${photos.length}`;
    prevBtn.hidden = photos.length < 2;
    nextBtn.hidden = photos.length < 2;
  }

  function go(delta) {
    idx = (idx + delta + photos.length) % photos.length;
    render();
  }

  function close() {
    if (!_instance) return;
    document.removeEventListener("keydown", onKey);
    overlay.remove();
    _instance = null;
    if (opts.onAfterClose) opts.onAfterClose();
  }

  function onKey(e) {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") go(-1);
    else if (e.key === "ArrowRight") go(1);
  }

  prevBtn.addEventListener("click", (e) => { e.stopPropagation(); go(-1); });
  nextBtn.addEventListener("click", (e) => { e.stopPropagation(); go(1); });
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  let touchStartX = null;
  overlay.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) touchStartX = e.touches[0].clientX;
  }, { passive: true });
  overlay.addEventListener("touchend", (e) => {
    if (touchStartX == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
    touchStartX = null;
    if (Math.abs(dx) < 40) return;
    go(dx > 0 ? -1 : 1);
  }, { passive: true });

  document.addEventListener("keydown", onKey);
  _instance = { close };
  render();
  return close;
}
