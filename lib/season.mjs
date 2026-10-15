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

// Halloween sale (owner, card #188): 30% off the Modded Pass and Andronix Complete, regional prices too.
// Off unless active is true; then the sale prices show only between start and end (UTC, end exclusive:
// the sale ends Nov 1, 23:59:59 UTC). The struck-through price is the lowest price in the 30 days
// before the sale (EU reference price; never $6.99). Owner discounts are unchanged.
export const SALE = {
  active: false,
  name: 'halloween',
  percent: '30%',
  pass: '$3.14',
  passWas: '$4.49',
  complete: '$4.19',
  completeWas: '$5.99',
  until: 'Nov 1',
  start: '2026-10-15T00:00:00Z',
  end: '2026-11-02T00:00:00Z',
};

export const SALE_FOOTNOTE =
  '* Halloween sale: 30% off the Modded Pass and Andronix Complete until November 1, 2026, 23:59 UTC, on regional prices too. Struck-through prices are the lowest prices in the 30 days before the sale. Prices vary by region, and Google Play shows your final price before you buy.';
