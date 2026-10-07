export type ReadingAnchor = { section: string | null; offset: number; scrollTop: number };
export function captureAnchor(host: HTMLElement): ReadingAnchor {
  // Top is an explicit reading position, including a close/reopen snapshot.
  if (host.scrollTop <= 0) return { section: null, offset: 0, scrollTop: 0 };
  const { top, bottom } = host.getBoundingClientRect();
  const visible = (node: HTMLElement) => { const rect = node.getBoundingClientRect(); return rect.bottom > top + 4 && rect.top < bottom; };
  const sections = [...host.querySelectorAll<HTMLElement>('[data-section-id]')];
  const paragraphs = [...host.querySelectorAll<HTMLElement>('[data-reading-anchor]')];
  const section = paragraphs.find(visible) ?? sections.find(visible);
  return { section: section?.dataset.readingAnchor ?? section?.dataset.sectionId ?? null, offset: section ? section.getBoundingClientRect().top - top : 0, scrollTop: host.scrollTop };
}
export function restoreAnchor(host: HTMLElement, anchor: ReadingAnchor) {
  const section = [...host.querySelectorAll<HTMLElement>('[data-reading-anchor], [data-section-id]')].find(node => (node.dataset.readingAnchor ?? node.dataset.sectionId) === anchor.section);
  host.scrollTop = section ? host.scrollTop + section.getBoundingClientRect().top - host.getBoundingClientRect().top - anchor.offset : anchor.scrollTop;
}
