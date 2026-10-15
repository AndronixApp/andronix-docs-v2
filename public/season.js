// Runs before first paint: turns the seasonal look on (html[data-season], html[data-season-level]) and the
// seasonal sale on (html[data-sale]), each only inside its own window (start and end in UTC, end exclusive),
// so both turn themselves off with no redeploy. A dismissed bar stays hidden (html[data-season-bar-dismissed]).
// ?season=<name> previews the look and the sale outside the dates; &level=medium|strong previews an intensity.
// External file (not inline) so the Content-Security-Policy can stay script-src 'self'.
// Shared by andronix.app and docs.andronix.app: keep both copies the same.
try {
  var s = document.currentScript.dataset
  var q = new URLSearchParams(location.search)
  var now = new Date()
  var preview = q.get('season') === s.name
  var inside = function (a, b) { return !!a && !!b && now >= new Date(a) && now < new Date(b) }
  var root = document.documentElement
  var attrs = {}
  if (preview || inside(s.start, s.end)) {
    var level = q.get('level')
    attrs['data-season'] = s.name
    attrs['data-season-level'] = level === 'strong' || level === 'medium' ? level : s.level
    try { if (!preview && localStorage.getItem('andronix-banner-' + s.id) === 'dismissed') attrs['data-season-bar-dismissed'] = '' } catch (e) {}
  }
  if (s.sale && (preview || inside(s.saleStart, s.saleEnd))) attrs['data-sale'] = s.sale
  var apply = function () { for (var k in attrs) if (root.getAttribute(k) !== attrs[k]) root.setAttribute(k, attrs[k]) }
  apply()
  // A framework that re-renders <html> on hydration (the docs, Next.js) drops these attributes: put them back.
  if (window.MutationObserver) new MutationObserver(function () {
    if (root.hasAttribute('data-season-bar-dismissed')) attrs['data-season-bar-dismissed'] = ''
    apply()
  }).observe(root, {attributes: true})
  // Halloween favicon (by icon, A1 "Moonrise on orange"). The docs re-render the head's icon links on
  // hydration, so swap again whenever the head changes.
  if (attrs['data-season'] && s.favicon) {
    var map = {'/favicon.ico': 'favicon.ico', '/icon.svg': 'icon.svg', '/apple-touch-icon.png': 'apple-touch-icon.png'}
    var swap = function () {
      document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach(function (l) {
        var f = map[l.getAttribute('href')]
        if (f) l.setAttribute('href', s.favicon + f)
      })
    }
    document.addEventListener('DOMContentLoaded', function () {
      swap()
      if (window.MutationObserver) new MutationObserver(swap).observe(document.head, {childList: true, subtree: true, attributes: true, attributeFilter: ['href']})
    })
  }
} catch (e) {}
