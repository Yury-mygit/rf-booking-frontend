// Topbar support-button: показывается в client/partner блоках, ведёт
// на `#/<block>/support`. Бейдж непрочитанного периодически обновляется
// от API; live-обновление через SSE — отдельной задачей.
//
// init вызывается один раз из main.js. Внутренне навешивает click +
// MutationObserver на body.dataset.block.

import { api } from "../api.js";
import { navigate } from "../router.js";

const POLL_MS = 60_000;

let _pollTimer = null;
let _lastBlock = null;

function btn() {
  return document.getElementById("support-btn");
}

function blockOf() {
  return document.body.dataset.block || "";
}

async function refreshBadge() {
  const b = btn();
  if (!b) return;
  if (!api.hasToken()) {
    b.classList.remove("has-unread");
    return;
  }
  const block = blockOf();
  if (block !== "client" && block !== "partner") {
    b.classList.remove("has-unread");
    return;
  }
  try {
    const thread = await api.getMyThread(block);
    b.classList.toggle("has-unread", !!(thread && thread.has_unread));
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
  const b = btn();
  if (!b) return;
  const block = blockOf();
  const visible = block === "client" || block === "partner";
  b.hidden = !visible;
  if (visible && _lastBlock !== block) {
    _lastBlock = block;
    startPolling();
  } else if (!visible) {
    _lastBlock = null;
    stopPolling();
    b.classList.remove("has-unread");
  }
}

export function installSupportTopbar() {
  const b = btn();
  if (!b) return;

  b.addEventListener("click", () => {
    const block = blockOf();
    if (block === "client") navigate("#/client/support");
    else if (block === "partner") navigate("#/partner/support");
  });

  sync();
  new MutationObserver(sync).observe(document.body, {
    attributes: true,
    attributeFilter: ["data-block"],
  });

  // При смене hash (например, юзер вошёл в support и прочитал тред) —
  // обновим бейдж через короткую задержку.
  window.addEventListener("hashchange", () => {
    setTimeout(refreshBadge, 500);
  });
}
