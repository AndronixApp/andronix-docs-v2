// The OpenPanel `filter` (a function source string the component inlines). With Do Not Track or
// Global Privacy Control on, nothing is sent. Under /chat it's an allowlist (build plan 1.8,
// review 2 F4): only screen_view and the page's chat_* events pass (no link_out, copy_code or
// anything else the SDK adds), __path and __referrer are cut to origin + pathname, and a /chat
// screen_view within 3 s of the last one is dropped (clearing the fragment makes a second view).
export function openPanelFilter(chatEvents) {
  return "function(e){var n=navigator;if(n.doNotTrack==='1'||window.doNotTrack==='1'||n.globalPrivacyControl===true)return false;" +
    "var p=location.pathname;if(p!=='/chat'&&p.indexOf('/chat/')!==0)return true;" +
    "if(!e||e.type!=='track')return !!e&&e.type==='identify';" +
    "var name=e.payload&&e.payload.name;var ok=" + JSON.stringify(chatEvents) + ";" +
    "if(name!=='screen_view'&&ok.indexOf(name)<0)return false;" +
    "var pr=e.payload.properties||{};var cut=function(u){try{var x=new URL(u,location.origin);return x.origin+x.pathname}catch(_){return location.origin+location.pathname}};" +
    "pr.__path=cut(pr.__path||location.href);if(pr.__referrer)pr.__referrer=cut(pr.__referrer);e.payload.properties=pr;" +
    "if(name==='screen_view'){var t=Date.now();if(window.__chatView&&t-window.__chatView<3000)return false;window.__chatView=t}" +
    "return true}";
}
