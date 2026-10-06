// Floating support button для клиентского блока и entry-формы «Режим».
// Живёт поверх всех слоёв (position: fixed, высокий z-index), прячется:
//   — вне блоков {client, entry};
//   — на самом `#/client/support` (внутри поддержки кнопка не нужна).
//
// Клик → `#/client/support`. Бейдж непрочитанного через polling
// `getMyThread("client")` раз в 60с (симметрично topbar-кнопке).

import { api } from "../api.js";
import { navigate } from "../router.js";

const POLL_MS = 60_000;

let _pollTimer = null;
let _active = false;

function fab() {
  return document.getElementById("support-fab");
}

function blockOf() {
  return document.body.dataset.block || "";
}

function onSupportRoute() {
  return location.hash.startsWith("#/client/support");
}

function isFabBlock() {
  const b = blockOf();
  return b === "client" || b === "entry";
}

async function refreshBadge() {
  const f = fab();
  if (!f || !api.hasToken()) return;
  if (!isFabBlock()) {
    f.classList.remove("has-unread");
    return;
  }
  try {
    const thread = await api.getMyThread("client");
    f.classList.toggle("has-unread", !!(thread && thread.has_unread));
  } catch {
    // Фоновый poll — ошибки не показываем.
  }
}

function startPolling() {
  stopPolling();
  refreshBadge();
  _pollTimer = setInterval(refreshBadge, POLL_MS);
}

function stopPolling() {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
}

function sync() {
  const f = fab();
  if (!f) return;
  const visible = isFabBlock() && !onSupportRoute();
  f.hidden = !visible;
  if (visible && !_active) {
    _active = true;
    startPolling();
  } else if (!visible && _active) {
    _active = false;
    stopPolling();
    f.classList.remove("has-unread");
  }
}

export function installSupportFab() {
  const f = fab();
  if (!f) return;

  f.addEventListener("click", () => navigate("#/client/support"));

  sync();
  new MutationObserver(sync).observe(document.body, {
    attributes: true,
    attributeFilter: ["data-block"],
  });

  window.addEventListener("hashchange", () => {
    sync();
    setTimeout(refreshBadge, 500);
  });
}
