// Events the /chat page itself may send (build plan 1.10, sender = page). The OpenPanel filter in
// app/layout.tsx lets only these (and screen_view) through under /chat; scripts/check-chat-events.mjs
// checks them against the vendored chat-events.schema.json when it's there.
export const CHAT_PAGE_EVENTS = ["chat_opened", "chat_signin_shown", "chat_signin_completed", "chat_code_check", "chat_rating_prompt"];
