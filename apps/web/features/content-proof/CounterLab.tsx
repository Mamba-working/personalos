'use client';
import React, { useState } from 'react';
import styles from './proof.module.css';
export default function CounterLab({ instruction, step }: { instruction: string; step: number }) {
  const [count, setCount] = useState(0), [draft, setDraft] = useState('');
  return <div className={styles.lab} data-lab-instance="small-counter">
    <div className={styles.counter}><output aria-label="当前计数" data-counter>{count}</output><button type="button" onClick={() => setCount(value => value + step)}>加 {step}</button><button type="button" onClick={() => setCount(0)}>归零</button></div>
    <label className={styles.draftLabel}>留下一句未完成的话<input data-lab-input value={draft} onChange={event => setDraft(event.target.value)} placeholder="这个念头，先放在这里…" /></label>
    <p className={styles.instruction} data-server-instruction>{instruction}</p>
  </div>;
}
