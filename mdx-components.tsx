import type { MDXComponents } from 'mdx/types';
import { ImageZoom } from 'fumadocs-ui/components/image-zoom';
import defaultComponents from 'fumadocs-ui/mdx';
import Imagera from '@/components/imagera';
import { Callout } from '@/components/callout';
import AppShot from '@/components/app-shot';
import TerminalDemo from '@/components/terminal-demo';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultComponents,
    img: (props) => <ImageZoom {...(props as any)} />,
    Imagera,
    Callout,
    AppShot,
    TerminalDemo,
    ...components,
  };
}
