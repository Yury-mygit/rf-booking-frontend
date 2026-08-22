// Generic bottomnav primitive — 3 уровня.
//   Меню первого уровня  → #bottomnav       (setBottomNav)
//   Меню второго уровня  → #subbottomnav    (setSubBottomNav)      — субменю
//   Меню третьего уровня → #subsubbottomnav (setSubSubBottomNav)   — подменю
//                                                                    от 2-го
// Каждый блок (partner/admin/settings/client) собирает свой набор items и
// вызывает соответствующий setter.
//
// Item: { key, label, icon, active?, href?, onClick? }
//   href → <a href="#<path>">; без href → <button type="button">.
//
// Idempotent update (TBB-16, 2026-07-02): подписью shape'а (набор keys/
// labels/icons/href/mode) храним в `data-bn-shape`. Если следующий вызов
// приходит с тем же shape'ом (например переключение между subform'ами
// одного hub'а — items совпадают, только `active` смещается), innerHTML
// не пересобирается — обновляется только класс `.active` и `onclick`
// property кнопок. Это избавляет от мигания nav-панелей при переходах.

function shapeSig(items, opts) {
  const mode = opts && opts.mode ? opts.mode : "";
  return items
    .map((it) =>
      [it.key || "", it.label || "", it.icon || "", it.href || ""].join("|"),
    )
    .join("\n") + "@" + mode;
}

function renderNav(nav, items) {
  nav.innerHTML = items
    .map((it) => {
      const cls = `bn-item${it.active ? " active" : ""}`;
      const keyAttr = it.key ? ` data-nav-key="${it.key}"` : "";
      const inner = it.icon || "";
      return it.href
        ? `<a class="${cls}" href="#${it.href}"${keyAttr}>${inner}</a>`
        : `<button class="${cls}" type="button"${keyAttr}>${inner}</button>`;
    })
    .join("");
  // Присоединяем onClick к каждой кнопке через property (не addEventListener),
  // чтобы при idempotent-обновлении можно было переставить handler без
  // накопления слушателей.
  const btns = nav.querySelectorAll("button.bn-item");
  let bi = 0;
  items.forEach((it) => {
    if (it.href) return;
    if (it.onClick) btns[bi].onclick = it.onClick;
    bi++;
  });
}

function updateNavInPlace(nav, items) {
  const els = nav.children;
  let bi = 0;
  items.forEach((it, i) => {
    const el = els[i];
    if (!el) return;
    el.classList.toggle("active", !!it.active);
    // Refresh onClick — closure может ссылаться на устаревший state.
    if (!it.href && el.tagName === "BUTTON") {
      el.onclick = it.onClick || null;
    }
    bi++;
  });
}

function setNav(nav, items, opts) {
  if (!nav) return;
  nav.hidden = false;
  if (opts && opts.mode) nav.dataset.bnMode = opts.mode;
  else delete nav.dataset.bnMode;
  if (!items || items.length === 0) {
    nav.innerHTML = "";
    delete nav.dataset.bnShape;
    return;
  }
  const sig = shapeSig(items, opts || {});
  if (nav.dataset.bnShape === sig) {
    updateNavInPlace(nav, items);
    return;
  }
  renderNav(nav, items);
  nav.dataset.bnShape = sig;
}

export function setBottomNav(items, opts = {}) {
  const nav = document.getElementById("bottomnav");
  setNav(nav, items, opts);
  const empty = !items || items.length === 0;
  if (nav && empty) nav.hidden = true;
  document.body.classList.toggle("nav-hidden", empty);
}

export function hideBottomNav() {
  const nav = document.getElementById("bottomnav");
  if (!nav) return;
  nav.hidden = true;
  nav.innerHTML = "";
  delete nav.dataset.bnShape;
  document.body.classList.add("nav-hidden");
}

// Sub-bottomnav — секционная панель табов, рендерится над главным #bottomnav.
// Item-shape тот же ({ key, label, icon, active?, href?, onClick? }), стиль
// `.bn-item` переиспользуется. View-сторона должна дополнительно ставить
// `document.body.classList.add("has-subnav")` — `main#app` тогда получает
// увеличенный padding-bottom.
export function setSubBottomNav(items, opts = {}) {
  setNav(document.getElementById("subbottomnav"), items, opts);
}

export function hideSubBottomNav() {
  const nav = document.getElementById("subbottomnav");
  if (!nav) return;
  nav.hidden = true;
  nav.innerHTML = "";
  delete nav.dataset.bnShape;
  document.body.classList.remove("has-subnav");
}

// Меню третьего уровня — подменю от subbottomnav'а. Item-shape тот же
// ({ key, label, icon, active?, href?, onClick? }), стиль `.bn-item`
// переиспользуется. View-сторона должна дополнительно ставить
// `document.body.classList.add("has-subsubnav")` — `main#app` тогда
// получает увеличенный padding-bottom.
export function setSubSubBottomNav(items, opts = {}) {
  setNav(document.getElementById("subsubbottomnav"), items, opts);
}

export function hideSubSubBottomNav() {
  const nav = document.getElementById("subsubbottomnav");
  if (!nav) return;
  nav.hidden = true;
  nav.innerHTML = "";
  delete nav.dataset.bnShape;
  document.body.classList.remove("has-subsubnav");
}
