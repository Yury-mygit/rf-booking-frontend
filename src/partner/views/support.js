// Тонкие partner-обёртки над общей реализацией user-side support views.

import {
  renderUserSupportList,
  renderUserSupportNew,
  renderUserSupportThread,
} from "../../widgets/support_user_views.js";

const BASE = "/partner/support";

export const renderPartnerSupportList = () =>
  renderUserSupportList({ baseUrl: BASE });

export const renderPartnerSupportNew = () =>
  renderUserSupportNew({ baseUrl: BASE });

export const renderPartnerSupportThread = (number) =>
  renderUserSupportThread({ baseUrl: BASE, number });
