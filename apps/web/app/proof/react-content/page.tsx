import type { Metadata } from 'next';
import ContentProof from '../../../features/content-proof/ContentProof';
import ContentBody from '../../../features/content-proof/ContentBody';
import { readContentProof, revisionFromQuery } from '../../../services/server/content-proof-fixture';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'React 内容与版本更新 · 独立证明 | PersonalOS', description: '一篇中文长文与一个有状态 Lab 的独立演示。检验真实组件身份、原生阅读与 RSC 内容更新。', robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams, snapshot = await readContentProof(revisionFromQuery(query.rev));
  const item = snapshot.records.find(record => record.id === query.item)?.id ?? null;
  return <ContentProof revision={snapshot.revision} initialItem={item} entries={snapshot.records.map(record => ({ record: { id: record.id, revision: record.revision, space: record.space, kind: record.kind, title: record.title, summary: record.summary, provenance: record.provenance }, body: <ContentBody key={record.id} record={record} /> }))} />;
}
