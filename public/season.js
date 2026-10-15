// Runs before first paint: turns the seasonal look on (html[data-season], html[data-season-level])
// when now is inside its window (start and end in UTC, end exclusive) and the visitor hasn't dismissed the bar.
// ?season=<name> previews it outside the dates; &level=medium|strong previews an intensity.
// External file (not inline) so the Content-Security-Policy can stay script-src 'self'.
try {
  var s = document.currentScript.dataset
  var q = new URLSearchParams(location.search)
  var now = new Date()
  var preview = q.get('season') === s.name
  if (preview || (now >= new Date(s.start) && now < new Date(s.end))) {
    var root = document.documentElement
    var level = q.get('level')
    root.setAttribute('data-season', s.name)
    root.setAttribute('data-season-level', level === 'strong' || level === 'medium' ? level : s.level)
    // Halloween favicon (by icon, A1 "Moonrise on orange"), swapped once the head's icon links exist
    if (s.favicon) document.addEventListener('DOMContentLoaded', function () {
      var map = {'/favicon.ico': 'favicon.ico', '/icon.svg': 'icon.svg', '/apple-touch-icon.png': 'apple-touch-icon.png'}
      document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach(function (l) {
        var f = map[l.getAttribute('href')]
        if (f) l.setAttribute('href', s.favicon + f)
      })
    })
    try { if (!preview && localStorage.getItem('andronix-banner-' + s.id) === 'dismissed') root.setAttribute('data-season-bar-dismissed', '') } catch (e) {}
  }
} catch (e) {}
