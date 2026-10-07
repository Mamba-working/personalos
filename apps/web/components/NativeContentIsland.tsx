"use client";
import { useEffect, useRef, useState } from 'react';
import { mountContent, type ManifestRecord } from '../native/content/controller';
export default function NativeContentIsland({initialHtml,manifest}: {initialHtml: string; manifest: readonly ManifestRecord[]}) {
  // Never replace live descendants on router.refresh or a parent render.
  const [snapshot] = useState(() => ({__html: initialHtml}));
  const [initialManifest] = useState(manifest);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => { const controller = mountContent(host.current!, initialManifest); return () => controller.dispose(); }, [initialManifest]);
  return <div id="native-content-island" ref={host} dangerouslySetInnerHTML={snapshot} />;
}
