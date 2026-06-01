// Централизованное состояние API client: токен, юзер, accessible owners +
// активный owner. Persists в localStorage. Сюда ходят http.js (за токеном)
// и partner.js / chat.js (за active owner + token для SSE).

const TOKEN_KEY = "rfbook_token";
const USER_KEY = "rfbook_user";
const OWNERS_KEY = "rfbook_accessible_owners";
const ACTIVE_OWNER_KEY = "rfbook_active_owner_id";

let _token = localStorage.getItem(TOKEN_KEY) || "";
let _user = JSON.parse(localStorage.getItem(USER_KEY) || "null");
let _accessibleOwners = JSON.parse(localStorage.getItem(OWNERS_KEY) || "[]");
let _activeOwnerId = (() => {
  const raw = localStorage.getItem(ACTIVE_OWNER_KEY);
  return raw ? Number(raw) : null;
})();

export const state = {
  token: () => _token,
  user: () => _user,
  accessibleOwners: () => _accessibleOwners,
  activeOwnerId() {
    if (_accessibleOwners.length === 0) return null;
    if (
      _activeOwnerId &&
      _accessibleOwners.some((o) => o.owner_user_id === _activeOwnerId)
    ) {
      return _activeOwnerId;
    }
    return _accessibleOwners[0].owner_user_id;
  },
  setToken(token) {
    _token = token;
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  },
  setSession(token, user, accessibleOwners) {
    _token = token;
    _user = user;
    localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (accessibleOwners !== undefined) {
      _accessibleOwners = accessibleOwners || [];
      localStorage.setItem(OWNERS_KEY, JSON.stringify(_accessibleOwners));
      // reset selector if previously selected owner is no longer accessible
      if (
        _activeOwnerId &&
        !_accessibleOwners.some((o) => o.owner_user_id === _activeOwnerId)
      ) {
        _activeOwnerId = null;
        localStorage.removeItem(ACTIVE_OWNER_KEY);
      }
    }
  },
  setActiveOwnerId(id) {
    _activeOwnerId = id;
    if (id) localStorage.setItem(ACTIVE_OWNER_KEY, String(id));
    else localStorage.removeItem(ACTIVE_OWNER_KEY);
    window.dispatchEvent(new CustomEvent("ownerchange"));
  },
  canDo(perm, ownerId) {
    const oid = ownerId ?? state.activeOwnerId();
    if (!oid) return false;
    const o = _accessibleOwners.find((x) => x.owner_user_id === oid);
    return !!(o && o.perms && o.perms[perm]);
  },
  clear() {
    _token = "";
    _user = null;
    _accessibleOwners = [];
    _activeOwnerId = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(OWNERS_KEY);
    localStorage.removeItem(ACTIVE_OWNER_KEY);
  },
};
