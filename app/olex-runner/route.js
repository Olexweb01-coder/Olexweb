// Olex AI's code runner: a tiny page the admin loads in a locked-down, invisible frame (sandboxed, no access to the
// admin, its cookies or its pages). It runs JavaScript and Python (Pyodide, from jsDelivr) in background workers that
// are stopped if they run too long. Nothing here touches the server or the database.
export const dynamic = 'force-static'
const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Olex AI runner</title></head><body><script>
"use strict";
var PY = ${JSON.stringify(PYODIDE)}, MAX = 20000, parentWin = null;
var JS_SRC = "var send=function(s,a){postMessage({type:'out',stream:s,text:a.map(function(x){if(typeof x==='string')return x;try{return JSON.stringify(x,null,2)}catch(e){return String(x)}}).join(' ')+'\\\\n'})};" +
  "console.log=function(){send('out',[].slice.call(arguments))};console.info=console.log;console.debug=console.log;console.warn=function(){send('err',[].slice.call(arguments))};console.error=console.warn;" +
  "self.onmessage=async function(e){try{var F=Object.getPrototypeOf(async function(){}).constructor;var r=await new F(e.data.code)();if(r!==undefined)send('out',[r]);postMessage({type:'done'})}catch(err){postMessage({type:'error',text:String(err&&err.stack||err)})}};";
var PY_SRC = "importScripts('" + PY + "pyodide.js');var py=null;" +
  "self.onmessage=async function(e){try{if(!py){postMessage({type:'status',text:'Loading Python. The first run takes a few seconds\\\\u2026'});py=await loadPyodide({indexURL:'" + PY + "'})}" +
  "py.setStdout({batched:function(s){postMessage({type:'out',stream:'out',text:s+'\\\\n'})}});py.setStderr({batched:function(s){postMessage({type:'out',stream:'err',text:s+'\\\\n'})}});" +
  "await py.loadPackagesFromImports(e.data.code,{messageCallback:function(m){postMessage({type:'status',text:m})}});" +
  "var r=await py.runPythonAsync(e.data.code);if(r!==undefined&&r!==null){postMessage({type:'out',stream:'out',text:String(r)+'\\\\n'})}postMessage({type:'done'})}" +
  "catch(err){postMessage({type:'error',text:String(err&&err.message||err)})}};";
var blob = function (s) { return URL.createObjectURL(new Blob([s], { type: 'text/javascript' })) };
var pyWorker = null, pyReady = false;
function run(msg) {
  var lang = msg.lang, id = msg.id, size = 0, timer = 0, w;
  var reply = function (m) { m.id = id; if (parentWin) parentWin.postMessage(m, '*') };
  var finish = function (m) { clearTimeout(timer); reply(m); if (lang === 'js') w.terminate() };
  if (lang === 'py') { if (!pyWorker) { pyWorker = new Worker(blob(PY_SRC)); pyReady = false } w = pyWorker } else w = new Worker(blob(JS_SRC));
  var limit = lang === 'py' ? (pyReady ? 20000 : 90000) : 8000;
  timer = setTimeout(function () { w.terminate(); if (lang === 'py') pyWorker = null; reply({ type: 'timeout', text: 'Stopped after ' + Math.round(limit / 1000) + ' seconds. Code that runs forever, or waits for input(), can\\u2019t finish here.' }) }, limit);
  w.onmessage = function (e) {
    var m = e.data;
    if (m.type === 'out') { if (size > MAX) return; size += m.text.length; if (size > MAX) m.text = m.text.slice(0, Math.max(0, MAX - (size - m.text.length))) + '\\n[output cut short]\\n'; reply(m) }
    else if (m.type === 'status') reply(m)
    else { if (lang === 'py') pyReady = true; finish(m) }
  };
  w.onerror = function (e) { e.preventDefault(); finish({ type: 'error', text: String(e.message || 'The code could not run.') }) };
  w.postMessage({ code: String(msg.code || '') });
}
window.addEventListener('message', function (e) {
  var m = e.data; if (!m || m.olex !== 'run') return;
  if (e.source !== window.parent) return;
  parentWin = e.source; run(m);
});
window.parent.postMessage({ olex: 'runner-ready' }, '*');
</script></body></html>`
const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net",
  "worker-src blob:",
  "connect-src https://cdn.jsdelivr.net",
  "frame-ancestors 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')
export function GET() {
  return new Response(HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'public, max-age=3600' } })
}
