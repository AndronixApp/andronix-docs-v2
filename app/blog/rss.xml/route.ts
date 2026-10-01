import { source } from '@/lib/source';
import { SITE_URL, absoluteUrl, frontmatter, isBlogPost } from '@/lib/seo';

// The blog's RSS feed, written once at build time into out/blog/rss.xml.
export const dynamic = 'force-static';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function GET() {
  const posts = source
    .getPages()
    .filter(isBlogPost)
    .map((page) => ({ page, date: frontmatter(page).date }))
    .filter((p): p is { page: typeof p.page; date: Date } => p.date !== undefined)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const items = posts
    .map(({ page, date }) => {
      const url = absoluteUrl(page.url);
      return `    <item>
      <title>${esc(page.data.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${date.toUTCString()}</pubDate>
      <description>${esc(page.data.description ?? '')}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Andronix blog</title>
    <link>${SITE_URL}/blog</link>
    <atom:link href="${SITE_URL}/blog/rss.xml" rel="self" type="application/rss+xml"/>
    <description>Releases, guides and announcements from the Andronix team: Linux on Android without root.</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
