export const categories = ['all', 'work', 'thoughts', 'labs'] as const;
export type Category = (typeof categories)[number];
export type ContentRecord = { id: string; category: Exclude<Category, 'all'>; title: string; summary: string; meta: string; height: number; kind: string; index: string; placeholder: true };
export type RouteState = { category: Category; item: string | null; chat: boolean };
export function parseRoute(params: URLSearchParams, records: readonly Pick<ContentRecord, 'id' | 'category'>[]): RouteState {
  const selected = records.find(record => record.id === params.get('item'));
  const input = params.get('space');
  let category: Category = categories.find(value => value === input) ?? 'all';
  if (selected && category !== 'all' && category !== selected.category) category = selected.category;
  return { category, item: selected?.id ?? null, chat: params.get('chat') === 'open' };
}
export function routeURL(state: RouteState, current: string): URL {
  const url = new URL(current);
  if (state.category === 'all') url.searchParams.delete('space'); else url.searchParams.set('space', state.category);
  if (state.item) url.searchParams.set('item', state.item); else url.searchParams.delete('item');
  if (state.chat) url.searchParams.set('chat', 'open'); else url.searchParams.delete('chat');
  return url;
}
