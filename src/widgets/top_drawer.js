// Top-drawer widget — modal-like шторка, спускающаяся из-под топбара.
// TBB-70: используется в шапке клиентского списка отелей для фильтров
// «Направление / Заезд / Выезд / Гости».
//
// API:
//   openTopDrawer({ title, render, onClose? }) — mount shell + backdrop,
//     вызвать `render(bodyEl, close)` для наполнения. `close()` закрывает.
//   closeTopDrawer() — программное закрытие (последнего открытого).
//
// Один активный drawer одновременно (второй вызов openTopDrawer сначала
// закрывает предыдущий). Клик по backdrop или Esc — close + onClose.

let _current = null;

export function openTopDrawer({ title = "", render, onClose }) {
  closeTopDrawer();

  const backdrop = document.createElement("div");
  backdrop.className = "td-backdrop";
  const shell = document.createElement("div");
  shell.className = "td-shell";
  shell.setAttribute("role", "dialog");
  shell.setAttribute("aria-modal", "true");
  shell.innerHTML = `
    <div class="td-head">
      <div class="td-title">${escape(title)}</div>
      <button type="button" class="td-close" aria-label="Close">×</button>
    </div>
    <div class="td-body"></div>
  `;
  document.body.appendChild(backdrop);
  document.body.appendChild(shell);
  document.body.classList.add("td-open");

  const body = shell.querySelector(".td-body");
  const close = () => {
    if (_current !== state) return;
    document.body.classList.remove("td-open");
    backdrop.remove();
    shell.remove();
    document.removeEventListener("keydown", onKeyDown);
    _current = null;
    if (onClose) onClose();
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") close();
  };

  backdrop.addEventListener("click", close);
  shell.querySelector(".td-close").addEventListener("click", close);
  document.addEventListener("keydown", onKeyDown);

  const state = { close };
  _current = state;

  if (render) render(body, close);
  return close;
}

export function closeTopDrawer() {
  if (_current) _current.close();
}

function escape(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}
