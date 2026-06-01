import { call } from "./http.js";

export const auth = {
  authTg: (initData) => call("POST", "/auth/tg", { init_data: initData }),
  whoami: () => call("GET", "/auth/whoami"),
  authDev: (tgId, name, role = "client") => {
    const qs = new URLSearchParams({
      telegram_id: String(tgId),
      first_name: name,
      role,
    });
    return call("POST", `/auth/dev-login?${qs}`);
  },
};
