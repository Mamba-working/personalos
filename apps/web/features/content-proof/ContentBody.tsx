import React from 'react';
import type { ProofRecord } from '@personalos/contracts/content-proof';
import CounterLab from './CounterLab';
import styles from './proof.module.css';
/** Server composition: essay prose stays outside the client module graph. */
export default function ContentBody({ record }: { record: ProofRecord }) {
  return <>
    {record.kind === 'counter-lab' ? <CounterLab key={record.id} instruction={record.instruction} step={record.step} /> : null}
    <div className={styles.prose}>{record.sections.map(section => <section key={section.id} data-section-id={section.id}><h3>{section.heading}</h3>{section.paragraphs.map(paragraph => <p key={paragraph.id} data-reading-anchor={`${section.id}:${paragraph.id}`}>{paragraph.text}</p>)}</section>)}</div>
  </>;
}
