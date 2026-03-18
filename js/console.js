// js/console.js
const AppConsole = (() => {
  const MAX = 80;
  let entries = [];

  function _ts() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  }

  function _push(level, msg) {
    entries.push({ level, msg: String(msg), ts: _ts() });
    if (entries.length > MAX) entries.shift();
    _render();
  }

  function log(msg)   { _push('info',  msg); }
  function warn(msg)  { _push('warn',  msg); }
  function error(msg) { _push('error', msg); console.error('[FTE]', msg); }
  function clear()    { entries = []; _render(); }

  function _render() {
    const el = document.getElementById('app-console-body');
    if (!el) return;
    el.innerHTML = entries.map(e => {
      const cls = e.level === 'error' ? 'con-error' : e.level === 'warn' ? 'con-warn' : 'con-info';
      const icon = e.level === 'error' ? '✕' : e.level === 'warn' ? '⚠' : '›';
      return `<div class="con-line ${cls}"><span class="con-ts">${e.ts}</span><span class="con-icon">${icon}</span><span class="con-msg">${_esc(e.msg)}</span></div>`;
    }).join('');
    el.scrollTop = el.scrollHeight;

    // badge on toggle button
    const btn = document.getElementById('btn-toggle-console');
    if (btn) {
      const errs = entries.filter(e => e.level==='error').length;
      btn.dataset.badge = errs > 0 ? errs : '';
      btn.classList.toggle('has-errors', errs > 0);
    }
  }

  function _esc(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function toggle() {
    const panel = document.getElementById('app-console');
    if (!panel) return;
    const open = panel.classList.toggle('open');
    if (open) _render();
  }

  // Intercept global JS errors
  function install() {
    window.addEventListener('error', ev => {
      error(`Uncaught: ${ev.message} (${ev.filename}:${ev.lineno})`);
    });
    window.addEventListener('unhandledrejection', ev => {
      error(`Unhandled promise rejection: ${ev.reason}`);
    });
  }

  return { log, warn, error, clear, toggle, install };
})();
