// Opt-in local geometry recorder. This module never edits product layout,
// calls focus/blur/scroll, intercepts input, or sends a trace over the network.
export const DIAGNOSTIC_VERSION = 'mobile-flow-route-1';
export const BASELINE_COMMIT = 'e0c92f6e45317b962a6c382fb7bb58a00c92043f';
export const LIMITS = Object.freeze({ durationMs: 12000, sampleIntervalMs: 50, maxSamples: 300 });
const number = value => Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
const choice = (value, allowed) => allowed.includes(value) ? value : null;
const rect = node => {
  if (!node) return null;
  const r = node.getBoundingClientRect();
  return Object.fromEntries(['x','y','width','height','top','right','bottom','left'].map(key => [key, number(r[key])]));
};
const pixels = value => /^-?[\d.]+px$/.test(value || '') ? number(parseFloat(value)) : null;
const transform = value => value === 'none' ? 'none' : /^matrix(?:3d)?\([\d., e+-]+\)$/.test(value || '') && value.length < 260 ? value : 'other';
const activeType = node => {
  const tag = (node?.tagName || '').toLowerCase();
  return choice(tag, ['body','html','textarea','input','button','a','summary','select','div','section']) || 'other';
};
function geometry(node, win) {
  if (!node) return null;
  const css = win.getComputedStyle(node);
  return {
    rect: rect(node), hidden: !!node.hidden,
    scrollTop: number(node.scrollTop), scrollLeft: number(node.scrollLeft),
    clientWidth: number(node.clientWidth), clientHeight: number(node.clientHeight),
    scrollWidth: number(node.scrollWidth), scrollHeight: number(node.scrollHeight),
    display: choice(css.display, ['none','block','flex','grid','inline','inline-block']),
    position: choice(css.position, ['static','relative','absolute','fixed','sticky']),
    overflowX: choice(css.overflowX, ['visible','hidden','clip','auto','scroll']),
    overflowY: choice(css.overflowY, ['visible','hidden','clip','auto','scroll']),
    transform: transform(css.transform),
    inlineTop: pixels(node.style?.top), inlineLeft: pixels(node.style?.left),
    cssTop: pixels(css.top), cssLeft: pixels(css.left), cssBottom: pixels(css.bottom), fontSize: pixels(css.fontSize), maxHeight: pixels(css.maxHeight)
  };
}
// Explicit allowlist: do not replace this with DOM serialization or getState().
// Text, values, IDs, labels, URLs, user agent, keys and selection are never read.
export function readKeyboardGeometry(win, doc) {
  const vv = win.visualViewport, panel = doc.querySelector('#ai-canvas');
  const nodes = {
    root: doc.documentElement, chatRoot: doc.querySelector('.mobile-chat-page'), chatFrame: doc.querySelector('.mobile-chat-frame'), siteRoot: doc.querySelector('.app'), detailRoot: doc.querySelector('#stage'), body: doc.body,
    worldRoot: doc.querySelector('#ball-world-root'), worldCanvas: doc.querySelector('#world-stage canvas'), header: doc.querySelector('.topbar'),
    filters: doc.querySelector('.filters'), dialog: panel,
    chatHeader: panel?.querySelector('.canvas-head'), close: panel?.querySelector('#ai-close'),
    reader: panel?.querySelector('.canvas-reader'), transcript: panel?.querySelector('.canvas-scroll'),
    composer: panel?.querySelector('.canvas-composer'), input: panel?.querySelector('#question')
  };
  return {
    viewport: vv ? Object.fromEntries(['width','height','offsetTop','offsetLeft','pageTop','pageLeft','scale'].map(key => [key, number(vv[key])])) : null,
    window: { innerWidth: number(win.innerWidth), innerHeight: number(win.innerHeight), scrollX: number(win.scrollX), scrollY: number(win.scrollY), devicePixelRatio: number(win.devicePixelRatio) },
    document: { scrollTop: number(doc.scrollingElement?.scrollTop), scrollLeft: number(doc.scrollingElement?.scrollLeft), visibility: choice(doc.visibilityState, ['visible','hidden']) },
    state: {
      mobileFlow: choice(panel?.dataset.mobileFlow, ['opening','flow','closing']),
      open: doc.body.dataset.chatOpen === 'true',
      pageLocked: win.personalOSChat?.isPageLocked?.() === true,
      logicalFeedOffset: number(win.personalOSChat?.feedOffset?.()),
      phase: choice(panel?.dataset.motionPhase, ['closed','positioning','expanding','revealing','open','concealing','collapsing','returning']),
      layout: choice(panel?.dataset.chatViewport, ['keyboard']) || 'ordinary',
      scrollMode: choice(panel?.dataset.chatScrollMode, ['ANCHORING','PINNED','FOLLOWING','READING']),
      activeElementType: activeType(doc.activeElement)
    },
    nodes: Object.fromEntries(Object.entries(nodes).map(([key, node]) => [key, geometry(node, win)]))
  };
}
export function createKeyboardRecorder({win, doc, read = () => readKeyboardGeometry(win, doc), onState = () => {}}) {
  let running = false, began = 0, ended = 0, frame = null, deadline = null, lastFrame = -Infinity;
  let slots = new Array(LIMITS.maxSamples), size = 0, cursor = 0, dropped = 0, stopReason = null, layoutCommits = null;
  const pending = new Set(), removers = [];
  const elapsed = () => number(Math.max(0, win.performance.now() - began));
  const state = () => ({ running, count: size, dropped, elapsedMs: running ? elapsed() : ended, stopReason });
  function store(reasons) {
    // A suspended tab/long task may delay timers. Never read new geometry
    // after the capture deadline, including from a late focus/stop event.
    if (elapsed() > LIMITS.durationMs) return false;
    let snapshot;
    try {snapshot = read();} catch {snapshot = {captureError:'geometry-unavailable'};}
    const capturedAt = elapsed();
    if (capturedAt > LIMITS.durationMs) return false;
    const sample = { t: capturedAt, reasons, observedLayoutCommits:layoutCommits, ...snapshot };
    slots[cursor] = sample; cursor = (cursor + 1) % LIMITS.maxSamples;
    if (size < LIMITS.maxSamples) size++; else dropped++;
  }
  function listen(target, type, fn, options) {
    if (!target) return;
    target.addEventListener(type, fn, options);
    removers.push(() => target.removeEventListener(type, fn, options));
  }
  function sampleFrame(time) {
    if (!running) return;
    if (elapsed() >= LIMITS.durationMs) {stop('elapsed-limit');return;}
    if (time - lastFrame >= LIMITS.sampleIntervalMs) {
      lastFrame = time; store(['frame', ...pending]); pending.clear();
    }
    frame = win.requestAnimationFrame(sampleFrame);
  }
  function mark(reason, immediate = false) {
    return event => {
      if (!running) return;
      if (elapsed() >= LIMITS.durationMs) {stop('elapsed-limit');return;}
      if (event?.target?.closest?.('#keyboard-diagnostics')) return;
      if (immediate) store([reason]); else pending.add(reason);
    };
  }
  function stop(reason = 'manual') {
    if (!running) return false;
    stopReason = choice(reason, ['manual','elapsed-limit','pagehide','hidden','disposed']) || 'manual';
    store(['stop', ...pending]); pending.clear(); ended = Math.min(elapsed(),LIMITS.durationMs); running = false;
    if (frame !== null) win.cancelAnimationFrame(frame);
    if (deadline !== null) win.clearTimeout(deadline);
    frame = deadline = null;
    for (const remove of removers.splice(0)) remove();
    onState(state()); return true;
  }
  return {
    state,
    start() {
      if (running) return false;
      slots = new Array(LIMITS.maxSamples); size = cursor = dropped = ended = 0;
      pending.clear(); stopReason = null; layoutCommits = null; began = win.performance.now(); lastFrame = -Infinity; running = true;
      listen(doc, 'focus', mark('focus', true), {capture:true,passive:true});
      listen(doc, 'blur', mark('blur', true), {capture:true,passive:true});
      listen(win.visualViewport, 'resize', mark('viewport-resize'), {passive:true});
      listen(win.visualViewport, 'scroll', mark('viewport-scroll'), {passive:true});
      listen(win, 'personalos:chat-state', event => {if(elapsed()>=LIMITS.durationMs){stop('elapsed-limit');return;}const count=number(event.detail?.layoutCommits);if(count!==null&&count!==layoutCommits){layoutCommits=count;pending.add('layout-state');}}, {passive:true});
      listen(win, 'resize', mark('window-resize'), {passive:true});
      listen(win, 'scroll', mark('page-scroll'), {passive:true});
      listen(win, 'pagehide', () => stop('pagehide'), {passive:true});
      listen(doc, 'visibilitychange', () => {if (doc.visibilityState === 'hidden') stop('hidden');}, {passive:true});
      store(['start']); frame = win.requestAnimationFrame(sampleFrame);
      deadline = win.setTimeout(() => stop('elapsed-limit'), LIMITS.durationMs);
      onState(state()); return true;
    },
    stop,
    clear() { if (running) return false; slots = new Array(LIMITS.maxSamples); size = cursor = dropped = ended = 0; stopReason = null; onState(state()); return true; },
    trace() {
      const samples = Array.from({length:size}, (_, i) => slots[(cursor - size + i + LIMITS.maxSamples) % LIMITS.maxSamples]);
      return { schemaVersion:1, diagnosticVersion:DIAGNOSTIC_VERSION, baselineCommit:BASELINE_COMMIT,
        units:'CSS pixels and performance-relative milliseconds',
        privacy:'Geometry only; no text, keystrokes, selection contents, URL, or automatic upload.',
        limits:LIMITS, ...state(), samples };
    },
    dispose() {stop('disposed'); slots = new Array(LIMITS.maxSamples); size = 0;}
  };
}
export function mountKeyboardDiagnostics(win = window, doc = document) {
  if (new URLSearchParams(win.location.search).get('keyboardDiagnostics') !== '1') return null;
  if (doc.querySelector('#keyboard-diagnostics')) return null;
  const style = doc.createElement('style');
  style.textContent = '#keyboard-diagnostics{position:fixed;z-index:1001;top:max(8px,env(safe-area-inset-top));right:8px;color:#202123;font:12px/1.5 system-ui;max-width:min(340px,calc(100vw - 16px));pointer-events:none}#keyboard-diagnostics button{pointer-events:auto;min-height:44px;padding:7px 11px;border:1px solid #8b939f;border-radius:10px;background:#f7f7f8;color:#202123;font:inherit}#keyboard-diagnostics button:focus-visible{outline:2px solid #315fa7;outline-offset:2px}#keyboard-diagnostics [hidden]{display:none!important}#keyboard-diagnostics .kd-panel{pointer-events:auto;margin-top:4px;padding:12px;max-height:80dvh;overflow:auto;border:1px solid #8b939f;border-radius:12px;background:#f7f7f8;box-shadow:0 4px 15px #0002}#keyboard-diagnostics p{margin:0 0 9px}#keyboard-diagnostics .kd-actions{display:flex;gap:6px;flex-wrap:wrap}#keyboard-diagnostics .kd-text{box-sizing:border-box;display:block;width:100%;height:160px;max-height:30dvh;overflow:auto;margin-top:8px;font:16px/1.4 monospace;resize:vertical;background:white;color:#202123}#keyboard-diagnostics .kd-download{font-weight:600}#keyboard-diagnostics .kd-metrics{overflow-wrap:anywhere;font-variant-numeric:tabular-nums}';
  const control = doc.createElement('aside'); control.id = 'keyboard-diagnostics'; control.setAttribute('aria-label','本机键盘诊断');
  control.innerHTML = '<button type="button" class="kd-toggle" aria-expanded="true">收起诊断</button><div class="kd-panel"><p>只在本机记录 12 秒布局数值，不记录聊天文字、按键或选区内容，也不会自动上传。</p><p class="kd-status" role="status">先打开聊天，再开始记录并点输入框</p><p class="kd-metrics">暂无完整记录</p><div class="kd-actions"><button type="button" class="kd-start">开始记录 12 秒</button><button type="button" class="kd-download" disabled>下载 JSON</button><button type="button" class="kd-copy" disabled>复制完整记录</button><button type="button" class="kd-view" disabled>查看完整记录</button><button type="button" class="kd-share" disabled>系统分享文件（可选）</button><button type="button" class="kd-clear" disabled>清除记录</button></div><div class="kd-fallback" hidden><p>下面是完整 JSON。可长按选取，或点全选后使用系统复制；记录较长时建议下载文件。</p><button type="button" class="kd-select">全选记录</button><textarea class="kd-text" readonly aria-label="完整诊断 JSON"></textarea></div></div>';
  doc.head.append(style); doc.body.append(control);
  const get = name => control.querySelector('.kd-'+name), panel = get('panel'), toggle = get('toggle'), status = get('status');
  let expanded = true, prepared = null;
  const filename = 'personalos-mobile-flow-trace.json';
  const recorder = createKeyboardRecorder({win,doc,onState:state=>{
    prepared = null; get('fallback').hidden = true; get('text').value = '';
    if (!state.running && state.count) {
      const trace = recorder.trace(), text = JSON.stringify(trace,null,2);
      const blob = new win.Blob([text],{type:'application/json'});
      prepared = {text,blob,bytes:blob.size,count:trace.samples.length,schema:trace.schemaVersion};
    }
    get('start').textContent = state.count ? '重新记录 12 秒' : '开始记录 12 秒';
    get('start').disabled = state.running;
    for (const name of ['download','copy','view','share','clear']) get(name).disabled = state.running || !prepared;
    get('metrics').textContent = prepared ? '样本 '+prepared.count+' 条 · 完整 JSON '+prepared.bytes+' 字节 · 首字段 "schemaVersion": '+prepared.schema : state.running ? '记录中，停止后显示实际条数与文件大小' : '暂无完整记录';
    if (state.running) {expanded = false; status.textContent = '正在记录；请复现键盘问题，12 秒后自动停止';}
    else status.textContent = prepared ? '记录已保留在本机。建议下载 JSON 文件，或复制完整记录。' : '先打开聊天，再开始记录并点输入框';
    render();
  }});
  function render() {panel.hidden = !expanded;toggle.textContent = recorder.state().running ? '停止记录' : expanded ? '收起诊断' : recorder.state().count ? '查看记录' : '键盘诊断';toggle.setAttribute('aria-expanded',String(expanded));}
  function ready() {return !recorder.state().running && !!prepared;}
  function showText() {
    if (!ready()) return;
    get('text').value = prepared.text; get('text').readOnly = true; get('fallback').hidden = false;
  }
  function download() {
    if (!ready()) return;
    const url = win.URL.createObjectURL(prepared.blob), link = doc.createElement('a');
    link.href = url; link.download = filename; link.hidden = true; control.append(link); link.click(); link.remove();
    status.textContent = '已发起下载 '+filename+'（'+prepared.bytes+' 字节）。请确认下载的是 JSON 文件。';
    win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);
  }
  toggle.addEventListener('click',()=>{if(recorder.state().running){recorder.stop();return;}expanded=!expanded;render();});
  get('start').addEventListener('click',()=>recorder.start());
  get('clear').addEventListener('click',()=>recorder.clear());
  get('download').addEventListener('click',download);
  get('view').addEventListener('click',showText);
  get('select').addEventListener('click',()=>{if(ready())get('text').select();});
  get('copy').addEventListener('click',async()=>{
    if (!ready()) return;
    const record = prepared;
    if (!win.navigator.clipboard?.writeText) {showText();status.textContent='此浏览器无法直接复制。完整记录已显示，可长按选取或全选后复制。';return;}
    try {await win.navigator.clipboard.writeText(record.text);if(prepared===record)status.textContent='已复制完整 JSON：'+record.count+' 条，'+record.bytes+' 字节，schemaVersion '+record.schema+'。';}
    catch {if(prepared===record){showText();status.textContent='复制未获准。完整记录已显示，可手动选取复制或直接下载 JSON。';}}
  });
  get('share').addEventListener('click',async()=>{
    if (!ready()) return;
    const record = prepared;
    if (!win.File || !win.navigator.share) {status.textContent='此浏览器不支持文件分享，请直接下载 JSON 或复制完整记录。';return;}
    const file = new win.File([record.blob],filename,{type:'application/json'});
    if (!win.navigator.canShare?.({files:[file]})) {status.textContent='此浏览器不支持分享 JSON 文件，请直接下载或复制完整记录。';return;}
    try {
      // No title-only payload: the selected destination must accept the file.
      // A resolved native promise does NOT prove the recipient received bytes.
      await win.navigator.share({files:[file]});
      if(prepared===record)status.textContent='系统分享已结束，但无法确认接收方收到完整文件。请核对附件；下载与复制仍可使用。';
    } catch(error) {
      if(error?.name==='AbortError')return;
      if(prepared===record)status.textContent='系统分享未完成；请直接下载 JSON 或复制完整记录。';
    }
  });
  return {dispose(){recorder.dispose();prepared=null;control.remove();style.remove();}};
}
