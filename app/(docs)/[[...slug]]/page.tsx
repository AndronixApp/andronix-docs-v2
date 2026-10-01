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
import { OG_IMAGE, SITE_NAME, SITE_URL, absoluteUrl, canonicalPath, frontmatter, isBlogPost, lastModified } from '@/lib/seo';

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

// Structured data (schema.org): the site name on the home page, breadcrumbs on every page,
// and Article on blog posts. Server-rendered into the static HTML.
function JsonLd({ page }: { page: NonNullable<ReturnType<typeof source.getPage>> }) {
  const items: object[] = [];
  const url = absoluteUrl(canonicalPath(page));

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

  if (isBlogPost(page)) {
    const { date } = frontmatter(page);
    const modified = lastModified(page);
    items.push({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: page.data.title,
      description: page.data.description,
      url,
      mainEntityOfPage: url,
      image: [`${SITE_URL}${OG_IMAGE.url}`],
      ...(date && { datePublished: date.toISOString() }),
      ...(date && modified && modified > date && { dateModified: modified.toISOString() }),
      author: { '@type': 'Organization', name: 'Andronix', url: 'https://andronix.app' },
      publisher: { '@type': 'Organization', name: 'Andronix', url: 'https://andronix.app', logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` } },
    });
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

  const { date, metaTitle } = frontmatter(page);
  const canonical = canonicalPath(page);
  const title = metaTitle ?? page.data.title;
  const description = page.data.description;
  // Next replaces (doesn't merge) the layout's openGraph and twitter objects, so set them in full.
  return {
    title: metaTitle ? { absolute: metaTitle } : page.data.title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      images: [OG_IMAGE],
      ...(isBlogPost(page)
        ? { type: 'article', ...(date && { publishedTime: date.toISOString() }) }
        : { type: 'website' }),
    },
    twitter: { card: 'summary_large_image', title, description, images: [OG_IMAGE] },
  };
}
