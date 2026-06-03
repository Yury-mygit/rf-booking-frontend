// Внутренняя горизонтальная навигация для admin Support — 6 разделов.
// Render'ится в начале каждой support-view (Inbox/Agents/Tags/Cats/
// Settings/Canned). Активный — по `data-key` совпадение.

import { t } from "../../../i18n.js";

const TABS = [
  { key: "inbox",      path: "/admin/support",            labelKey: "support.title" },
  { key: "agents",     path: "/admin/support/agents",     labelKey: "support.agents.title" },
  { key: "tags",       path: "/admin/support/tags",       labelKey: "support.tags.title" },
  { key: "categories", path: "/admin/support/categories", labelKey: "support.categories.title" },
  { key: "settings",   path: "/admin/support/settings",   labelKey: "support.settings.title" },
  { key: "canned",     path: "/admin/support/canned",     labelKey: "support.canned.title" },
];

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

export function renderSupportSubNav(activeKey) {
  return `
    <div class="support-subnav">
      ${TABS.map((t1) => `
        <a class="support-subtab${t1.key === activeKey ? " active" : ""}"
           href="#${t1.path}">
          ${esc(t(t1.labelKey))}
        </a>
      `).join("")}
    </div>
  `;
}
