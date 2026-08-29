// Top-drawer widget — floating шторка над формой, БЕЗ backdrop'а.
// Стакается: второй вызов openTopDrawer не закрывает предыдущий, а
// накладывается сверху. Sub-drawer наследует минимальную высоту от
// parent'а (Yury: «шторка блока не может быть меньше шторки фильтров»).
//
// API:
//   openTopDrawer({ title, render, onClose? }) → close()
//   closeTopDrawer() — закрывает топовый.
//
// Закрытие каждого — Esc (только топовый), `.td-close` (×), или явный
// close-элемент из body. Форма под drawer'ами (непокрытая часть)
// остаётся видимой и интерактивной.

let _stack = [];

function _onEsc(e) {
  if (e.key === "Escape" && _stack.length) {
    _stack[_stack.length - 1].close();
  }
}

export function openTopDrawer({ title = "", render, onClose }) {
  const parentShell = _stack.length ? _stack[_stack.length - 1].shell : null;
  const parentHeight = parentShell
    ? parentShell.getBoundingClientRect().height
    : null;
  const zIndex = 41 + _stack.length * 2;

  const shell = document.createElement("div");
  shell.className = "td-shell";
  shell.setAttribute("role", "dialog");
  shell.style.zIndex = String(zIndex);
  if (parentHeight) shell.style.minHeight = `${parentHeight}px`;
  shell.innerHTML = `
    <div class="td-head">
      <div class="td-title">${escape(title)}</div>
      <button type="button" class="td-close" aria-label="Close">×</button>
    </div>
    <div class="td-body"></div>
  `;
  if (_stack.length === 0) document.addEventListener("keydown", _onEsc);
  document.body.appendChild(shell);
  document.body.classList.add("td-open");

  const body = shell.querySelector(".td-body");
  const entry = { shell };
  const close = () => {
    const idx = _stack.indexOf(entry);
    if (idx === -1) return;
    _stack.splice(idx, 1);
    shell.remove();
    if (_stack.length === 0) {
      document.body.classList.remove("td-open");
      document.removeEventListener("keydown", _onEsc);
    }
    if (onClose) onClose();
  };
  entry.close = close;
  _stack.push(entry);

  shell.querySelector(".td-close").addEventListener("click", close);

  if (render) render(body, close);
  return close;
}

export function closeTopDrawer() {
  if (_stack.length) _stack[_stack.length - 1].close();
}

function escape(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}
