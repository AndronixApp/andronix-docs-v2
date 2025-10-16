import { ImageZoom } from 'fumadocs-ui/components/image-zoom';
import defaultComponents from 'fumadocs-ui/mdx';
import Imagera from '@/components/imagera';

type MDXComponents = Record<string, React.ComponentType<any>>;

export function useMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultComponents,
    img: (props) => <ImageZoom {...(props as any)} />,
    Imagera,
    ...components,
  };
}
