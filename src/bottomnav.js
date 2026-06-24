// Generic bottomnav primitive — рендерит элементы в #bottomnav.
// Каждый блок (partner/admin/settings) собирает свой набор items и
// вызывает setBottomNav.
//
// Item: { key, label, icon, active?, href?, onClick? }
//   href → <a href="#<path>">; без href → <button type="button">.

export function setBottomNav(items, opts = {}) {
  const nav = document.getElementById("bottomnav");
  if (!nav) return;
  nav.hidden = false;
  if (opts.mode) nav.dataset.bnMode = opts.mode;
  else delete nav.dataset.bnMode;
  if (!items || items.length === 0) {
    nav.innerHTML = "";
    return;
  }
  nav.innerHTML = items.map((it) => {
    const cls = `bn-item${it.active ? " active" : ""}`;
    const keyAttr = it.key ? ` data-nav-key="${it.key}"` : "";
    const inner = it.icon || "";
    return it.href
      ? `<a class="${cls}" href="#${it.href}"${keyAttr}>${inner}</a>`
      : `<button class="${cls}" type="button"${keyAttr}>${inner}</button>`;
  }).join("");
  nav.querySelectorAll("button.bn-item").forEach((btn, i) => {
    const handler = items.filter((x) => !x.href)[i]?.onClick;
    if (handler) btn.addEventListener("click", handler);
  });
}

export function hideBottomNav() {
  const nav = document.getElementById("bottomnav");
  if (!nav) return;
  nav.hidden = true;
  nav.innerHTML = "";
}

// Sub-bottomnav — секционная панель табов, рендерится над главным
// #bottomnav. Item-shape тот же ({ key, label, icon, active?, href?,
// onClick? }), стиль `.bn-item` переиспользуется. View-сторона должна
// дополнительно ставить `document.body.classList.add("has-subnav")` —
// `main#app` тогда получает увеличенный padding-bottom.
export function setSubBottomNav(items, opts = {}) {
  const nav = document.getElementById("subbottomnav");
  if (!nav) return;
  nav.hidden = false;
  if (opts.mode) nav.dataset.bnMode = opts.mode;
  else delete nav.dataset.bnMode;
  if (!items || items.length === 0) {
    nav.innerHTML = "";
    return;
  }
  nav.innerHTML = items.map((it) => {
    const cls = `bn-item${it.active ? " active" : ""}`;
    const keyAttr = it.key ? ` data-nav-key="${it.key}"` : "";
    const inner = it.icon || "";
    return it.href
      ? `<a class="${cls}" href="#${it.href}"${keyAttr}>${inner}</a>`
      : `<button class="${cls}" type="button"${keyAttr}>${inner}</button>`;
  }).join("");
  nav.querySelectorAll("button.bn-item").forEach((btn, i) => {
    const handler = items.filter((x) => !x.href)[i]?.onClick;
    if (handler) btn.addEventListener("click", handler);
  });
}

export function hideSubBottomNav() {
  const nav = document.getElementById("subbottomnav");
  if (!nav) return;
  nav.hidden = true;
  nav.innerHTML = "";
  document.body.classList.remove("has-subnav");
}
