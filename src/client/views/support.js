// Client-side support chat (карта #92).

import { renderUserSupportChat } from "../../widgets/support_user_views.js";

export const renderClientSupportChat = () =>
  renderUserSupportChat({ block: "client" });
