'use client';
import { Component, type ReactNode, type RefObject } from 'react';
import { captureAnchor, restoreAnchor, type ReadingAnchor } from './scroll-anchor';
type Props = { revision: number; reading: boolean; scrollHost: RefObject<HTMLDivElement | null>; children: ReactNode };
type Position = { mode: 'top' } | { mode: 'anchor'; anchor: ReadingAnchor };
type Snapshot = { position: Position; focus: HTMLElement | null; selection: [number | null, number | null, 'forward' | 'backward' | 'none' | null] | null } | null;
/** Capture before React mutates server-provided content; restore before browser paint. */
export default class RevisionBoundary extends Component<Props> {
  getSnapshotBeforeUpdate(previous: Props): Snapshot {
    const host = this.props.scrollHost.current;
    if (!host || previous.revision === this.props.revision) return null;
    const focus = host.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
    const selection = focus instanceof HTMLInputElement || focus instanceof HTMLTextAreaElement ? [focus.selectionStart, focus.selectionEnd, focus.selectionDirection] as NonNullable<Snapshot>['selection'] : null;
    const position: Position = previous.reading && this.props.reading && host.scrollTop > 0 ? { mode: 'anchor', anchor: captureAnchor(host) } : { mode: 'top' };
    return { position, focus, selection };
  }
  componentDidUpdate(_previous: Props, _state: unknown, snapshot: Snapshot) {
    const host = this.props.scrollHost.current;
    if (!snapshot || !host) return;
    // A preview is not a reader. Its clipped content must remain at the top.
    // Reader-at-top also retains that explicit position, not an offscreen prose anchor.
    if (this.props.reading && snapshot.position.mode === 'anchor') restoreAnchor(host, snapshot.position.anchor);
    else host.scrollTop = 0;
    if (snapshot.focus?.isConnected && host.contains(snapshot.focus)) {
      if (document.activeElement !== snapshot.focus) snapshot.focus.focus({ preventScroll: true });
      if (snapshot.selection && (snapshot.focus instanceof HTMLInputElement || snapshot.focus instanceof HTMLTextAreaElement)) snapshot.focus.setSelectionRange(snapshot.selection[0], snapshot.selection[1], snapshot.selection[2] ?? undefined);
    }
  }
  render() { return this.props.children; }
}
