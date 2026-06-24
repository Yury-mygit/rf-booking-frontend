import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { navigate } from "../../router.js";
import { setTitle } from "../../topbar.js";
import { escapeHtml, relativeTime } from "../../util.js";
import { setSubBottomNav } from "../nav.js";
import { TABS, TAB_ICONS, _state as STAFF_STATE } from "./staff_list/index.js";

const PAGE_SIZE = 50;
const ACTION_OPTIONS = [
  "",
  "hotel.create", "hotel.update", "hotel.publish", "hotel.unpublish", "hotel.delete",
  "room.create", "room.update", "room.delete", "room.availability_update",
  "service.create", "service.update", "service.delete",
  "booking.confirm", "booking.cancel", "walkin.create",
  "client.update",
  "staff.add", "staff.update", "staff.remove",
];

const _state = { offset: 0, action: "", q: "", since: "", until: "", items: [], hasMore: true };

// Standalone /partner/audit route: поднимаем staff-субпанель (journal
// активен), а клики по другим табам переключают _state.active и
// переходят на /partner/staff. Когда audit рендерится как 4-й таб из
// staff_list, эта функция всё равно вызывается (renderAudit), но
// document.body.classList уже стоит — повторный add дешёвый.
function mountStaffSubnav() {
  STAFF_STATE.active = "journal";
  document.body.classList.add("has-subnav");
  setTitle(`${t("pageTitle.staff")} / ${t("staff.tab.journal")}`);
  setSubBottomNav(
    TABS.map((name) => ({
      key: name,
      label: t("staff.tab." + name),
      icon: TAB_ICONS[name],
      active: name === "journal",
      onClick: () => {
        STAFF_STATE.active = name;
        if (name === "journal") return; // уже здесь
        navigate("#/partner/staff");
      },
    })),
  );
}

export async function renderAudit() {
  const app = document.getElementById("app");
  const ownerId = api.activeOwnerId();
  if (!ownerId) {
    app.innerHTML = `<p class="muted">${t("audit.no_owner")}</p>`;
    return;
  }

  mountStaffSubnav();

  // Title set by parent (partner/index.js syncTopChrome via titleKey,
  // или вызывающий staff-таб). Здесь только тело.
  app.innerHTML = `
    <div class="audit-filters">
      <label>${t("audit.q_filter")}
        <input id="audit-q" type="search" placeholder="${t("audit.q_placeholder")}" value="${_state.q}">
      </label>
      <label>${t("audit.action_filter")}
        <select id="audit-action">
          ${ACTION_OPTIONS.map((a) => `<option value="${a}">${a ? a : t("audit.action_any")}</option>`).join("")}
        </select>
      </label>
      <label>${t("audit.since")}
        <input id="audit-since" type="date" value="${_state.since}">
      </label>
      <label>${t("audit.until")}
        <input id="audit-until" type="date" value="${_state.until}">
      </label>
      <button class="secondary" id="audit-csv">${t("audit.export_csv")}</button>
    </div>
    <div id="audit-body"><p class="muted">${t("app.loading")}</p></div>
    <div class="row-actions" id="audit-pager"></div>
  `;

  const actionSel = document.getElementById("audit-action");
  actionSel.value = _state.action;
  actionSel.onchange = (e) => { _state.action = e.target.value; resetAndLoad(); };

  const qInput = document.getElementById("audit-q");
  let qTimer = null;
  qInput.oninput = (e) => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { _state.q = e.target.value.trim(); resetAndLoad(); }, 300);
  };

  document.getElementById("audit-since").onchange = (e) => { _state.since = e.target.value; resetAndLoad(); };
  document.getElementById("audit-until").onchange = (e) => { _state.until = e.target.value; resetAndLoad(); };

  document.getElementById("audit-csv").onclick = async () => {
    try {
      await api.downloadAuditCsv(_currentOpts());
    } catch (e) {
      alert(t("app.error", { msg: e.message }));
    }
  };

  resetAndLoad();
}

function _currentOpts() {
  const opts = { ownerId: api.activeOwnerId() };
  if (_state.action) opts.action = _state.action;
  if (_state.q) opts.q = _state.q;
  if (_state.since) opts.since = _state.since;
  if (_state.until) opts.until = _state.until;
  return opts;
}

async function resetAndLoad() {
  _state.offset = 0;
  _state.items = [];
  _state.hasMore = true;
  await loadPage();
}

async function loadPage() {
  const opts = { ..._currentOpts(), limit: PAGE_SIZE, offset: _state.offset };
  let page;
  try {
    page = await api.listAudit(opts);
  } catch (e) {
    document.getElementById("audit-body").innerHTML =
      `<div class="error">${t("app.error", { msg: e.message })}</div>`;
    return;
  }
  _state.hasMore = page.length === PAGE_SIZE;
  _state.items = _state.items.concat(page);
  renderBody();
  renderPager();
}

function renderBody() {
  const body = document.getElementById("audit-body");
  if (_state.items.length === 0) {
    body.innerHTML = `<p class="muted">${t("audit.empty")}</p>`;
    return;
  }
  body.innerHTML = `
    <div class="table-scroll">
      <table class="recent-table">
        <thead>
          <tr>
            <th>${t("audit.col_when")}</th>
            <th>${t("audit.col_who")}</th>
            <th>${t("audit.col_action")}</th>
            <th>${t("audit.col_subject")}</th>
            <th>${t("audit.col_payload")}</th>
          </tr>
        </thead>
        <tbody>${_state.items.map(renderRow).join("")}</tbody>
      </table>
    </div>
  `;
}

function renderRow(a) {
  const actor = `${escapeHtml(a.actor_display_name || "—")} · ${a.actor_role === "owner" ? "владелец" : "сотрудник"}`;
  const subject = a.subject_type
    ? `${a.subject_type}#${a.subject_id ?? "—"}`
    : "—";
  const payloadShort = a.payload ? JSON.stringify(a.payload) : "—";
  return `
    <tr>
      <td title="${escapeHtml(a.created_at)}">${escapeHtml(relativeTime(a.created_at, t))}</td>
      <td>${actor}</td>
      <td><code>${escapeHtml(a.action)}</code></td>
      <td>${escapeHtml(subject)}</td>
      <td class="audit-payload">${escapeHtml(payloadShort.slice(0, 120))}${payloadShort.length > 120 ? "…" : ""}</td>
    </tr>
  `;
}

function renderPager() {
  const pager = document.getElementById("audit-pager");
  if (!pager) return;
  pager.innerHTML = _state.hasMore
    ? `<button class="secondary" id="audit-more">${t("audit.load_more")}</button>`
    : (_state.items.length > 0 ? `<p class="muted">${t("audit.no_more")}</p>` : "");
  const btn = document.getElementById("audit-more");
  if (btn) {
    btn.onclick = async () => {
      _state.offset += PAGE_SIZE;
      btn.disabled = true;
      await loadPage();
    };
  }
}
