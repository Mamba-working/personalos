import 'server-only';
import type { Metadata } from 'next';
import NativeContentIsland from '../components/NativeContentIsland';
import { records } from '../lib/server/demo-content';
import { renderContent } from '../lib/server/content-html';
import { parseRoute, routeURL } from '../lib/navigation/route-state';
export const dynamic = 'force-dynamic';
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
async function route(props: Props) {
  const values = await props.searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (typeof value === 'string') params.set(key, value);
  return parseRoute(params, records);
}
export async function generateMetadata(props: Props): Promise<Metadata> {
  const state = await route(props), record = records.find(record => record.id === state.item);
  return { title: record ? `${record.title} | PersonalOS` : 'PersonalOS · authored demonstration space', description: record?.summary ?? '18 authored demonstration articles across Work, Thoughts and Labs.', alternates: { canonical: routeURL({...state,chat:false}, 'http://localhost/').pathname + routeURL({...state,chat:false}, 'http://localhost/').search } };
}
export default async function Page(props: Props) {
  const state = await route(props);
  return <NativeContentIsland initialHtml={renderContent(state)} manifest={records.map(({id,category,title,height,index,kind}) => ({id,category,title,height,index,kind}))} />;
}
