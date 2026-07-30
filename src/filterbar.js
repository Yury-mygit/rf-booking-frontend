// Filterbar — горизонтальная панель фильтров под topbar'ом. Симметрично
// bottomnav: один глобальный DOM-узел (#filterbar), низкоуровневый API
// заполнения. Виден только на тех view, которые сами вызывают
// setFilterBar([...]). По умолчанию (router.run сбрасывает) — hidden.
//
// Item: { key, label?, icon?, onClick, active?, variant? }.
// variant — суффикс CSS-класса для специальных стилей (например,
// цветовые токены статуса — окрашивают рамку и иконку).

export function setFilterBar(items, opts = {}) {
  const fb = document.getElementById("filterbar");
  if (!fb) return;
  fb.hidden = false;
  if (opts.mode) fb.dataset.fbMode = opts.mode;
  else delete fb.dataset.fbMode;
  if (!items || items.length === 0) {
    fb.innerHTML = "";
    return;
  }
  fb.innerHTML = items.map((it) => {
    const variantCls = it.variant ? ` fb-item--${it.variant}` : "";
    const activeCls = it.active ? " active" : "";
    const keyAttr = it.key ? ` data-fb-key="${it.key}"` : "";
    const labelHtml = it.label ? `<span class="fb-label">${it.label}</span>` : "";
    const inner = `${it.icon || ""}${labelHtml}`;
    return `<button class="fb-item${variantCls}${activeCls}" type="button"${keyAttr}>${inner}</button>`;
  }).join("");
  fb.querySelectorAll("button.fb-item").forEach((btn, i) => {
    const h = items[i]?.onClick;
    if (h) btn.addEventListener("click", h);
  });
}

export function hideFilterBar() {
  const fb = document.getElementById("filterbar");
  if (!fb) return;
  fb.hidden = true;
  fb.innerHTML = "";
  delete fb.dataset.fbMode;
}
