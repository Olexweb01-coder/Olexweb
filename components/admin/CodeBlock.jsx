'use client'
// A code block in Olex AI's answers: the file name or language, Copy, Download, and Run for JavaScript and Python
// (in the sandboxed runner; nothing runs on the server or touches the admin).
import { useState } from 'react'
import { toast } from './ui'
import { runCode, RUNNABLE } from './runner'
import { download, safePath } from './zip'
import { Icon } from './icons'

const EXT = { js: 'js', javascript: 'js', jsx: 'jsx', ts: 'ts', typescript: 'ts', tsx: 'tsx', py: 'py', python: 'py', html: 'html', css: 'css', json: 'json', sql: 'sql', bash: 'sh', sh: 'sh', shell: 'sh', powershell: 'ps1', ps1: 'ps1', php: 'php', md: 'md', markdown: 'md', yaml: 'yml', yml: 'yml', xml: 'xml', java: 'java', go: 'go', rust: 'rs', c: 'c', cpp: 'cpp', csharp: 'cs', cs: 'cs', ruby: 'rb', vue: 'vue', svelte: 'svelte', env: 'env', txt: 'txt' }
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true }
  catch { const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok }
}
export default function CodeBlock({ lang = '', path = '', code }) {
  const [copied, setCopied] = useState(false), [run, setRun] = useState(null)       // run: { busy, lines: [[stream, text]], status, end }
  const l = String(lang).toLowerCase(), runnable = RUNNABLE[l] || (path && RUNNABLE[(path.split('.').pop() || '').toLowerCase()])
  const NAMES = { js: 'JavaScript', javascript: 'JavaScript', py: 'Python', python: 'Python', ts: 'TypeScript', typescript: 'TypeScript', jsx: 'JSX', tsx: 'TSX', html: 'HTML', css: 'CSS', json: 'JSON', sql: 'SQL', sh: 'Shell', bash: 'Bash', powershell: 'PowerShell', php: 'PHP' }
  const label = path || (l ? NAMES[l] || l.charAt(0).toUpperCase() + l.slice(1) : 'Code')
  async function copy() { if (await copyText(code)) { setCopied(true); setTimeout(() => setCopied(false), 1600) } else toast('Copy didn’t work. Select the code and copy it.') }
  function save() { download(new Blob([code], { type: 'text/plain;charset=utf-8' }), safePath(path || `olex-code.${EXT[l] || 'txt'}`).split('/').pop()) }
  async function go() {
    if (run && run.busy) return
    setRun({ busy: true, lines: [], status: 'Running\u2026', end: null })
    try {
      const end = await runCode(runnable, code, (m) => setRun((r) => {
        if (m.type === 'out') return { ...r, lines: [...r.lines, [m.stream, m.text]], status: 'Running\u2026' }
        if (m.type === 'status') return { ...r, status: m.text }
        if (m.type === 'error' || m.type === 'timeout') return { ...r, lines: [...r.lines, ['err', m.text]] }
        return r
      }))
      setRun((r) => ({ ...r, busy: false, status: '', end }))
    } catch (e) { setRun({ busy: false, lines: [['err', e.message]], status: '', end: 'error' }) }
  }
  return (<div className="cblock">
    <div className="code-bar">
      <span className="code-name" title={label}>{label}</span>
      <span className="code-acts">
        {runnable ? <button type="button" onClick={go} disabled={run && run.busy} title="Run it here, safely, in your browser">{Icon.play}{run && run.busy ? 'Running' : 'Run'}</button> : null}
        {path ? <button type="button" onClick={save} title="Download this file">{Icon.download}<span className="sr-wide">Download</span></button> : null}
        <button type="button" onClick={copy} aria-live="polite">{copied ? Icon.check : Icon.copy}{copied ? 'Copied' : 'Copy'}</button>
      </span>
    </div>
    <pre className="md-pre"><code>{code}</code></pre>
    {run ? <div className={'code-out' + (run.end === 'error' || run.end === 'timeout' ? ' bad' : '')} role="status" aria-live="polite">
      <div className="code-out-bar"><span>{run.busy ? run.status || 'Running\u2026' : run.end === 'done' ? 'Output' : run.end === 'timeout' ? 'Stopped' : 'Error'}</span>
        {!run.busy ? <button type="button" onClick={() => setRun(null)} aria-label="Close the output">{Icon.close}</button> : null}</div>
      <pre>{run.lines.length ? run.lines.map(([s, t], i) => <span key={i} className={s === 'err' ? 'o-err' : ''}>{t}</span>) : (run.busy ? '' : 'Finished with no output. Use print() in Python or console.log() in JavaScript to show results.')}</pre>
    </div> : null}
  </div>)
}
