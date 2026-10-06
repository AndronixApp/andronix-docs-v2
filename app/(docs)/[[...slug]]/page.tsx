import { source } from '@/lib/source';
import {
  DocsPage,
  DocsBody,
  DocsDescription,
  DocsTitle,
} from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getBreadcrumbItems } from 'fumadocs-core/breadcrumb';
import { getMDXComponents } from '@/mdx-components';
import { OG_IMAGE, SITE_NAME, SITE_URL, absoluteUrl, canonicalPath, frontmatter, isUnlisted } from '@/lib/seo';

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);

  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <JsonLd page={page} />
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

// Structured data (schema.org): the site name on the home page and breadcrumbs on every page.
// Server-rendered into the static HTML. (The blog and its BlogPosting data are on andronix.app/blog.)
function JsonLd({ page }: { page: NonNullable<ReturnType<typeof source.getPage>> }) {
  const items: object[] = [];

  if (page.url === '/') {
    items.push({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      alternateName: ['Andronix Documentation', 'docs.andronix.app'],
      url: `${SITE_URL}/`,
      publisher: { '@type': 'Organization', name: 'Andronix', url: 'https://andronix.app' },
    });
  }

  if (canonicalPath(page) === page.url && page.url !== '/') {
    const crumbs = getBreadcrumbItems(page.url, source.getPageTree(), { includePage: true })
      .filter((c): c is { name: string; url: string } => typeof c.name === 'string' && typeof c.url === 'string');
    const list = [{ name: 'Docs', url: '/' }, ...crumbs];
    if (list.length > 1) {
      items.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: list.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: absoluteUrl(c.url) })),
      });
    }
  }

  if (items.length === 0) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(items.length === 1 ? items[0] : items).replace(/</g, '\\u003c') }}
    />
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);

  if (!page) notFound();

  const { metaTitle } = frontmatter(page);
  const canonical = canonicalPath(page);
  const title = metaTitle ?? page.data.title;
  const description = page.data.description;
  // Next replaces (doesn't merge) the layout's openGraph and twitter objects, so set them in full.
  return {
    title: metaTitle ? { absolute: metaTitle } : page.data.title,
    description,
    alternates: { canonical },
    // Not launched yet (lib/seo.ts): keep it out of search engines.
    ...(isUnlisted(page) && { robots: { index: false, follow: false } }),
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      images: [OG_IMAGE],
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title, description, images: [OG_IMAGE] },
  };
}
