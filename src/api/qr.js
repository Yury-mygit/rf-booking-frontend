// User-scoped QR (payment).

import { call, callMultipart } from "./http.js";

export const qr = {
  getMyQr: () => call("GET", "/me/qr"),
  uploadMyQr(file) {
    const fd = new FormData();
    fd.append("file", file);
    return callMultipart("POST", "/me/qr", fd);
  },
  deleteMyQr: () => call("DELETE", "/me/qr"),
};
