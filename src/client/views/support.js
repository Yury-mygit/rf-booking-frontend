// Тонкие client-обёртки над общей реализацией user-side support views.
// Логика и DOM идентичны partner-варианту — параметризация через
// baseUrl ("/client/support" vs "/partner/support") нужна только
// для navigate/href.

import {
  renderUserSupportList,
  renderUserSupportNew,
  renderUserSupportThread,
} from "../../widgets/support_user_views.js";

const BASE = "/client/support";

export const renderClientSupportList = () =>
  renderUserSupportList({ baseUrl: BASE });

export const renderClientSupportNew = () =>
  renderUserSupportNew({ baseUrl: BASE });

export const renderClientSupportThread = (number) =>
  renderUserSupportThread({ baseUrl: BASE, number });
