// Seasonal look (card #189), shared with andronix.app. Off unless active is true; then on only between
// start and end (UTC, end exclusive), so it turns itself off with no redeploy. Halloween 2026 (owner):
// from the 10.1 launch deploy until Nov 2 00:00 UTC. ?season=halloween previews it outside the dates,
// &level=medium|strong compares intensities. No sale line until card #188 is decided.
export const SEASON = {
  active: true,
  name: 'halloween',
  id: 'halloween-2026',
  level: 'medium',
  favicon: '/images/halloween/favicon/',
  start: '2026-10-15T00:00:00Z',
  end: '2026-11-02T00:00:00Z',
};
