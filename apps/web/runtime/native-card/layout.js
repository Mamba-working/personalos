// Native CSS owns layout; the transition projects measured children into a shell.
// No renderer, duplicate article, control-height constant or canvas counteroffset.
export const box = node => {
  const r = node.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
};
export function origin(child, parent) {
  return { x: child.x - parent.x, y: child.y - parent.y };
}
export function projection(desired, native) {
  return { x: desired.x - native.x, y: desired.y - native.y };
}
const savedStyle = node => node.getAttribute('style');
const restoreStyle = (node, value) => value === null ? node.removeAttribute('style') : node.setAttribute('style', value);

export function createReaderLayout({ shell, reader, canvas, controls, topbar }) {
  // Fail visibly rather than quietly combining geometry from unrelated styles.
  if (getComputedStyle(shell).getPropertyValue('--native-reader-layout').trim() !== '1') {
    throw new Error('Native card reader.css is required before mounting content');
  }
  shell.dataset.nativeCard = 'true';

  function measure(a) {
    const styles = [shell, a.identity, a.body, canvas].map(savedStyle);
    const offset = reader.scrollTop, reading = reader.classList.contains('reading');
    shell.style.setProperty('--native-reader-top', `${Math.max(12, topbar.getBoundingClientRect().bottom + 12)}px`);
    const top = shell.style.getPropertyValue('--native-reader-top');
    shell.dataset.measuring = 'true';
    shell.style.borderRadius = '';
    reader.classList.add('reading');
    a.identity.style.transform = '';
    a.body.style.transform = '';
    a.identity.style.width = `${a.lockedWidth}px`;
    a.article.style.setProperty('--identity-width', `${a.lockedWidth}px`);
    canvas.style.width = '';
    canvas.style.height = '';
    canvas.style.transform = '';
    reader.scrollTop = 0;
    const bounds = box(shell), identity = origin(box(a.identity), bounds), body = origin(box(a.body), bounds);
    const result = {
      bounds, identity, body,
      canvasWidth: canvas.getBoundingClientRect().width,
      controlsHeight: controls.getBoundingClientRect().height,
      radius: parseFloat(getComputedStyle(shell).borderTopLeftRadius),
      mobile: getComputedStyle(a.article).getPropertyValue('--native-card-stacked').trim() === '1',
    };
    delete shell.dataset.measuring;
    reader.classList.toggle('reading', reading);
    [shell, a.identity, a.body, canvas].forEach((node, i) => restoreStyle(node, styles[i]));
    shell.style.setProperty('--native-reader-top', top);
    a.identity.style.width = `${a.lockedWidth}px`;
    a.article.style.setProperty('--identity-width', `${a.lockedWidth}px`);
    canvas.style.width = `${result.canvasWidth}px`;
    reader.scrollTop = offset;
    return result;
  }

  function displayed(a) {
    const bounds = box(shell);
    return { bounds, identity: origin(box(a.identity), bounds), body: origin(box(a.body), bounds) };
  }

  function paint(a) {
    const p = a.pose, u = Math.max(0, Math.min(1, p.progress));
    Object.assign(shell.style, { transform: `translate3d(${p.x}px,${p.y}px,0)`, width: `${p.w}px`, height: `${p.h}px`, borderRadius: `${p.radius}px`, opacity: String(p.opacity) });
    const identity = projection({ x: p.ix, y: p.iy }, a.layout.identity);
    const body = projection({ x: p.bx, y: p.by }, a.layout.body);
    a.identity.style.transform = `translate3d(${identity.x}px,${identity.y}px,0) scale(${p.scale})`;
    a.body.style.transform = `translate3d(${body.x}px,${body.y}px,0)`;
    a.body.style.opacity = String(u);
    controls.style.opacity = String(u);
    controls.style.pointerEvents = u < .04 ? 'none' : '';
  }

  function captureScroll(a) {
    // Read the displayed coordinates first. Resetting scroll changes only the
    // viewport; the projection preserves the pixels until the shell moves.
    const current = displayed(a);
    a.pose.ix = current.identity.x; a.pose.iy = current.identity.y;
    a.pose.bx = current.body.x; a.pose.by = current.body.y;
    reader.classList.remove('reading');
    reader.scrollTop = 0;
    paint(a);
    return current;
  }

  function preview(a) {
    // Measure the SAME semantic subtree in its destination. It is restored
    // synchronously before a browser frame, so there is no visual reparent hop.
    const nodes = [a.article, a.identity, a.body], saved = nodes.map(savedStyle);
    const parent = a.article.parentNode, next = a.article.nextSibling;
    const focused = document.activeElement;
    const windowOffset = document.scrollingElement.scrollTop, readerOffset = reader.scrollTop;
    let result;
    try {
      a.slot.append(a.article);
      a.article.style.removeProperty('--identity-width');
      a.article.style.removeProperty('--body-width');
      a.identity.style.width = `${a.lockedWidth}px`;
      const scale = a.article.clientWidth / a.lockedWidth;
      a.identity.style.transform = `scale(${scale})`;
      a.body.style.transform = '';
      a.body.style.opacity = '';
      let bounds = box(a.slot);
      const identityBox = box(a.identity);
      const border = parseFloat(getComputedStyle(a.article).borderBottomWidth) || 0;
      const requiredHeight = Math.ceil(identityBox.y - bounds.y + identityBox.h + border);
      if (requiredHeight > bounds.h) {
        a.record.height = requiredHeight;
        a.slot.style.setProperty('--height', `${requiredHeight}px`);
        bounds = box(a.slot);
      }
      result = {
        bounds, identity: origin(box(a.identity), bounds), scale,
        radius: parseFloat(getComputedStyle(a.article).borderTopLeftRadius),
        styles: nodes.map(savedStyle),
      };
    } finally {
      parent.insertBefore(a.article, next);
      nodes.forEach((node, i) => restoreStyle(node, saved[i]));
      reader.scrollTop = readerOffset;
      if (document.scrollingElement.scrollTop !== windowOffset) document.scrollingElement.scrollTop = windowOffset;
      if (focused?.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
    }
    return result;
  }

  function returnToSlot(a) {
    [a.article, a.identity, a.body].forEach((node, i) => restoreStyle(node, a.preview.styles[i]));
    a.slot.append(a.article);
  }
  return Object.freeze({ measure, displayed, paint, captureScroll, preview, returnToSlot });
}
