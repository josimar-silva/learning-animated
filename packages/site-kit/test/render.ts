import { experimental_AstroContainer as AstroContainer } from 'astro/container';

type Container = Awaited<ReturnType<typeof AstroContainer.create>>;
type Component = Parameters<Container['renderToString']>[0];

// The only place that touches Astro's experimental Container API.
export async function render(
  component: Component,
  props: Record<string, unknown> = {},
  slots: Record<string, string> = {},
): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(component, { props, slots });
}
