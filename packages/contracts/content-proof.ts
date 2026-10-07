/** A bounded, serializable renderer contract. No React, DOM, persistence, or AI claims. */
export type Space = 'work' | 'thoughts' | 'labs';
export type Paragraph = { id: string; text: string };
export type Section = { id: string; heading: string; paragraphs: Paragraph[] };
type Entity = { id: string; revision: number; space: Space; title: string; summary: string; provenance: 'authored-demo' };
export type EssayRecord = Entity & { kind: 'essay'; sections: Section[] };
export type LabRecord = Entity & { kind: 'counter-lab'; instruction: string; step: number; sections: Section[] };
export type ProofRecord = EssayRecord | LabRecord;
export type ContentHeader = Pick<ProofRecord, 'id' | 'revision' | 'space' | 'kind' | 'title' | 'summary' | 'provenance'>;
export type ContentProof = { schemaVersion: 1; source: 'server-fixture'; revision: number; records: ProofRecord[] };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
export function parseContentProof(value: unknown): ContentProof {
  if (!object(value) || value.schemaVersion !== 1 || value.source !== 'server-fixture' || !integer(value.revision) || !Array.isArray(value.records)) throw new Error('Invalid content proof envelope');
  const ids = new Set<string>();
  for (const record of value.records) {
    if (!object(record) || !text(record.id) || ids.has(record.id) || !integer(record.revision) || !['work', 'thoughts', 'labs'].includes(String(record.space)) || !text(record.title) || !text(record.summary) || record.provenance !== 'authored-demo' || !['essay', 'counter-lab'].includes(String(record.kind)) || !Array.isArray(record.sections)) throw new Error('Invalid content record');
    ids.add(record.id);
    if (record.kind === 'counter-lab' && (!text(record.instruction) || !integer(record.step))) throw new Error('Invalid counter lab');
    const sections = new Set<string>();
    for (const section of record.sections) {
      if (!object(section) || !text(section.id) || sections.has(section.id) || !text(section.heading) || !Array.isArray(section.paragraphs) || !section.paragraphs.every(paragraph => object(paragraph) && text(paragraph.id) && text(paragraph.text)) || new Set(section.paragraphs.map(paragraph => paragraph.id)).size !== section.paragraphs.length) throw new Error('Invalid content section');
      sections.add(section.id);
    }
  }
  return value as ContentProof;
}
