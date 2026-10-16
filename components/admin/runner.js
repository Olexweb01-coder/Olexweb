'use client'
// Talks to the sandboxed code runner (/olex-runner): one invisible frame, shared by every Run button.
let frame = null, ready = null, seq = 0
const pending = new Map()
function boot() {
  if (ready) return ready
  ready = new Promise((resolve, reject) => {
    frame = document.createElement('iframe')
    frame.setAttribute('sandbox', 'allow-scripts')                   // no same-origin: it can't see the admin, its cookies or pages
    frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1; frame.title = 'Code runner'
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-9999px;top:0'
    const t = setTimeout(() => { ready = null; reject(new Error('The code runner didn’t start. Check your connection and try again.')) }, 15000)
    window.addEventListener('message', (e) => {
      if (!frame || e.source !== frame.contentWindow || !e.data) return
      if (e.data.olex === 'runner-ready') { clearTimeout(t); resolve(); return }
      const p = pending.get(e.data.id); if (!p) return
      p.onEvent(e.data)
      if (['done', 'error', 'timeout'].includes(e.data.type)) { pending.delete(e.data.id); p.resolve(e.data.type) }
    })
    frame.src = '/olex-runner'; document.body.appendChild(frame)
  })
  return ready
}
export const RUNNABLE = { js: 'js', javascript: 'js', mjs: 'js', py: 'py', python: 'py', python3: 'py' }
export async function runCode(lang, code, onEvent) {
  await boot()
  const id = ++seq
  return new Promise((resolve) => { pending.set(id, { onEvent, resolve }); frame.contentWindow.postMessage({ olex: 'run', id, lang, code }, '*') })
}
