// "You build it", realistic 3D (Install 36). One real thing is built IN PLACE in a real-looking world (a city, a field, the
// sea, space), as a chain of problems: "Your app lives on one computer. A million people open it, it overheats… so you
// line up racks… so you wrap them in a hall… Congratulations! You just built a data centre. Follow…"
// The AI writes the words AND the whole scene: every part in metres (from a kit of detailed models plus simple shapes)
// and, line by line, what is built, what changes and where the camera looks. Everything a line names is shown on
// screen in that line. The factory's engine (worker/real3d) films it. Plain code checks every scene before it is saved.
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { askJSON, writtenBy } from '@/lib/assistant/llm'
import { notify } from '@/lib/assistant/notify'
import EXAMPLE from './chain-example.json'

// what the engine can draw (worker/real3d/real.js and models.js)
export const MODELS = ['server_rack', 'battery_rack', 'chiller', 'generator', 'fence', 'cctv', 'person', 'guard', 'worker', 'guard_booth', 'cable_tray', 'shutter']
export const SHAPES = ['box', 'cyl', 'sphere', 'cone', 'ring', 'roof', 'tube', 'group', ...MODELS]
export const MATS = 'concrete steel steel_red steel_yellow black_metal white_metal aluminium copper gold glass glass_dark brick plaster dirt clay rock sand grass asphalt rubber plastic plastic_black wood water light screen led_green led_blue led_red cable_orange cable_black cable_blue fabric paint_white'.split(' ')
export const OPS = ['sink', 'lift', 'restore', 'move', 'turn', 'tilt', 'grow', 'shrink', 'shake', 'sway', 'swing', 'spin', 'stop', 'heat', 'cool', 'glow', 'dim', 'lights', 'smoke', 'sparks', 'flow', 'open', 'close', 'walk', 'patrol']
const PROBLEM_OPS = new Set(['sink', 'tilt', 'shake', 'sway', 'swing', 'heat', 'dim', 'smoke', 'sparks'])
const VIEWS = ['wide', 'close', 'under', 'high', 'low', 'front', 'side', 'left', 'right', 'top']
const HOWS = ['rise', 'drop', 'build', 'grow', 'pop', 'fade', 'slide'], HIDES = ['crumble', 'fade', 'sink', 'lift']
const FLOWS = ['data', 'power', 'electricity', 'water', 'cold', 'air', 'heat', 'fire', 'gas', 'money', 'fuel', 'signal', 'sound', 'message', 'light']
const SETTINGS = ['city', 'field', 'desert', 'sea', 'site', 'space']
// where the topics come from: the whole of tech and the internet, built as real things in real places
export const AREAS = ['the internet itself', 'phones and mobile networks', 'computers and chips', 'AI and robots', 'online security', 'money and payments', 'maps, GPS and satellites', 'messaging and social media', 'screens, cameras and sound', 'cars, EVs and transport tech', 'energy, batteries and power', 'space tech', 'websites and the cloud', 'games and consoles', 'everyday gadgets', 'shopping and delivery tech', 'smart homes and buildings', 'storage and memory', 'radio, Wi-Fi and signals', 'tech in hospitals, sport and cities']
const clean = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n)
const words = (s) => (String(s || '').match(/[A-Za-z0-9'’]+/g) || []).length
const norm = (s) => String(s || '').toLowerCase().replace(/^(a|an|the)\s+/, '').replace(/[^a-z0-9 ]/g, '').trim()
const num = (x, a, b, d) => { const n = Number(x); return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : d }
const vec = (v, n, a, b) => (Array.isArray(v) ? v.slice(0, n).map((x) => num(x, a, b, 0)) : null)
const YEAR = /\b(19|20)\d\d\b/
const BRANDS = /\b(google|apple|iphone|samsung|microsoft|windows|amazon|meta|facebook|instagram|whatsapp|tiktok|youtube|netflix|tesla|openai|chatgpt|nvidia|intel|visa|mastercard|paypal|uber|twitter|android|starlink|spacex)\b/i
export const FOLLOW = 'Follow, and next time we build something new.'

const SYSTEM = `You write and stage "You build it" videos: realistic 3D Shorts that explain how a real piece of technology works by letting the viewer build it, one problem at a time, in one place. You are a screenwriter and a set designer: every thing you say is built and shown on screen, at real size, in the right place. Plain spoken English, fast and surprising, facts correct.`
const SCHEMA = { type: 'object', properties: { topic: { type: 'string' }, answer: { type: 'string' }, titles: { type: 'array', items: { type: 'string' } }, ask: { type: 'string' }, scene: { type: 'object' } }, required: ['topic', 'answer', 'titles', 'scene'] }

function brief(area, avoid) {
  return `Make ONE "You build it" video about something in: ${area}. Pick it yourself: a real thing billions of people use or hear about, that can be BUILT as a real physical thing in one place (a data centre, a phone mast, an undersea internet cable, a chip factory, a solar farm, an EV charger, a satellite ground station, a cash machine, a lift, a smart traffic light, a wind turbine, a game console, a router…). Abstract ideas become physical (a password becomes a vault; the cloud becomes a data centre). It must NOT be any of these, already made: ${avoid.length ? avoid.join('; ') : 'none yet'}.

THE STORY (a chain of problems):
- Line 1: the simplest start, in place, never the answer ("Your app lives on one single computer.").
- Then each line: a new PROBLEM ("Then a million people open it at once.", "It overheats, and crashes.") or the FIX ("So you line up hundreds of computers in tall metal racks."). Problem, fix, problem, fix. Every fix is a real part of how the thing really works, and gets its real name on screen ("name").
- Keep the answer hidden until the end. The second-to-last line is exactly "Congratulations! You just built <the answer>." The last line is exactly "${FOLLOW}"
- 15 to 20 lines, 4 to 24 words each, 150 to 230 words in all (about a minute). Correct facts only. No brands, no company names, no years.

THE SCENE (the 3D engine films it):
- Units are metres. y is up, the ground is at y = 0, the camera's side (the front) is +z. "at" is the middle of a thing's bottom.
- The ground is cut open at the front at z = "cut": anything underground is only seen if it runs right at the cut (z = cut − 0.1). Put a front edge of the site about 1 metre behind the cut.
- "setting": ${SETTINGS.join(' | ')}. Build ONE thing in one place; every step adds to it or changes it IN PLACE (open it up, put parts inside it, swap parts). Never build it somewhere else and carry it over.
- parts: {"id","shape","size","at","rot":[deg x,y,z],"mat","color":"#hex","in":"groupId","repeat":{"n":[nx,ny,nz],"gap":[gx,gy,gz]},"windows":[cols,rows],"path":[[x,y,z],…],"round":false}
  shapes: box [w,h,d], cyl [r,h,(top r)], sphere [r], cone [r,h], ring [R,r], roof [w,h,d] (a gable), tube [radius] with "path" (cables, pipes, ducts, beams), group (a parent; parts with "in" sit relative to it and move with it).
  DETAILED MODELS (use them wherever they fit; they are real size and put themselves together piece by piece): ${MODELS.join(', ')} (fence takes size [length]; cable_tray takes size [length]; shutter takes size [w,h]; person/guard/worker are people; models face +z, turn them with rot).
  Build anything else from many small shapes (a car is a body, a cabin, 4 wheels, lights; a mast is a lattice of tubes; a house is walls, a roof, windows, a door). Small details make it real: doors, handles, bolts, vents, lights, cables, signs (use 30 to 70 parts).
  "repeat" makes copies in a grid (centred in x and z, stacked up in y) and they appear one by one.
  materials: ${MATS.join(', ')}. "windows":[cols,rows] gives a box a building face.
- steps (one per line): {"line","show":[ids],"how":"${HOWS.join('|')}","hide":[ids],"hideHow":"${HIDES.join('|')}","act":[{"id","op",…}],"look":[ids or {"at":[x,y,z],"r":metres}],"look2":[…],"view":"${VIEWS.join('|')}","zoom":1,"name":"Real name"}
  ops: sink {by,tilt}, lift {by}, restore, move {to}, turn {deg}, tilt {deg}, grow {to}, shrink {to}, shake {amp}, sway {deg}, swing {deg} (a group swings on its point), spin {speed} (fans, wheels, blades), stop, heat (glows red hot), cool, glow {color}, dim (lights off), lights (lights on), smoke, sparks, flow {along: a tube id | from, to; what: ${FLOWS.join('|')}} (glowing things travel along it), open / close (a guard_booth barrier), walk {to} (a person walks there), patrol {by}.
  A part is there from the start unless a step shows it. Spinning and flowing last only for their step: repeat them in later steps to keep them going.
- THE RULE THAT MATTERS MOST: everything a line names is SHOWN or CHANGED in that same step, and the camera LOOKS at it. "a fence all the way around" = fences on all four sides, built post by post; "cameras on every corner" = a cctv on each corner; "a guard at the gate" = a guard_booth and a guard who walks to the barrier, which opens; "cables from the racks, down the wall, under the ground" = one tube whose path really runs from the racks, down the wall, through the floor and along the cut. Things that connect really touch. A problem is shown too (heat, shake, smoke, sparks, sink, sway, dim).
- Camera: "look" at what the line is about (close for small things, "under" for things in the cut, "high" for roofs, "left"/"right"/"front" to see inside through an open side); "look2" makes the camera travel during the step (along a fence, down a cable). The last two steps look at the whole thing ("high" then "wide").
- Keep the inside visible: leave the front (+z) side of a building open as a cutaway, or make it glass.

A COMPLETE EXAMPLE (a data centre; do NOT copy the topic, copy the care):
${JSON.stringify(EXAMPLE)}

Also give: "topic" (what it is, 2 to 5 words, e.g. "a data centre"), "answer" (the same, as said in the congratulations line), "titles" (3 YouTube Shorts titles under 60 characters that make people curious without giving the answer away, e.g. "Your App Gets a Million Users. Now What?"), "ask" (a question for the comments, ends with "?"). Answer as JSON only: {"topic","answer","titles","ask","scene":{"setting","cut","parts","steps"}}.`
}

// ---------- checking it (plain code) ----------
export function shapeChain(d) {
  const sc = d && typeof d.scene === 'object' && d.scene ? d.scene : {}
  const parts = [], ids = new Set()
  for (const p of (Array.isArray(sc.parts) ? sc.parts : []).slice(0, 160)) {
    if (!p || typeof p !== 'object') continue
    const id = clean(p.id, 40); if (!id || ids.has(id)) continue
    const shape = SHAPES.includes(p.shape) ? p.shape : p.shape === 'cylinder' ? 'cyl' : ['pipe', 'cable'].includes(p.shape) ? 'tube' : 'box'
    const x = { id, shape, at: vec(p.at, 3, -400, 400) || [0, 0, 0] }
    if (p.size != null) x.size = (Array.isArray(p.size) ? p.size : [p.size]).slice(0, 3).map((v) => num(v, 0.01, 400, 1))
    if (p.rot) x.rot = vec(p.rot, 3, -360, 360)
    if (MATS.includes(p.mat)) x.mat = p.mat
    if (/^#[0-9a-f]{3,8}$/i.test(String(p.color || ''))) x.color = p.color
    if (p.repeat && Array.isArray(p.repeat.n)) { const n = p.repeat.n.slice(0, 3).map((v) => Math.round(num(v, 1, 60, 1))); if (n[0] * (n[1] || 1) * (n[2] || 1) <= 400) x.repeat = { n, gap: vec(p.repeat.gap, 3, -100, 100) || [2, 2, 2] } }
    if (Array.isArray(p.windows)) x.windows = p.windows.slice(0, 2).map((v) => Math.round(num(v, 1, 40, 4)))
    if (Array.isArray(p.path)) x.path = p.path.slice(0, 30).map((pt) => vec(pt, 3, -400, 400)).filter((pt) => pt && pt.length === 3)
    if (shape === 'tube' && (!x.path || x.path.length < 2)) continue
    if (p.round === false) x.round = false
    if (p.in) x.in = clean(p.in, 40)
    if (p.glass && /^#[0-9a-f]{3,8}$/i.test(p.glass)) x.glass = p.glass
    parts.push(x); ids.add(id)
  }
  const groups = new Set(parts.filter((p) => p.shape === 'group').map((p) => p.id))
  parts.forEach((p) => { if (p.in && !groups.has(p.in)) delete p.in })
  const look = (L) => (Array.isArray(L) ? L : L ? [L] : []).map((v) => (typeof v === 'string' ? (ids.has(v) ? v : null) : v && Array.isArray(v.at) ? { at: vec(v.at, 3, -400, 400), r: num(v.r, 0.5, 200, 3) } : null)).filter(Boolean)
  let steps = (Array.isArray(sc.steps) ? sc.steps : []).slice(0, 24).map((s) => {
    const o = { line: clean(s && s.line, 200) }
    o.show = (Array.isArray(s.show) ? s.show : []).filter((id) => ids.has(id)); o.hide = (Array.isArray(s.hide) ? s.hide : []).filter((id) => ids.has(id))
    if (HOWS.includes(s.how)) o.how = s.how; if (HIDES.includes(s.hideHow)) o.hideHow = s.hideHow
    o.act = (Array.isArray(s.act) ? s.act : []).slice(0, 10).filter((a) => a && OPS.includes(a.op)).map((a) => {
      const y = { op: a.op }
      if (a.id === 'all' || ids.has(a.id)) y.id = a.id
      if (a.op === 'flow') { if (ids.has(a.along)) y.along = a.along; if (ids.has(a.from)) y.from = a.from; if (ids.has(a.to)) y.to = a.to; y.what = FLOWS.includes(a.what) ? a.what : 'data'; if (a.keep) y.keep = true }
      if (Array.isArray(a.to) && a.op !== 'flow') y.to = vec(a.to, 3, -400, 400); else if (a.to != null && a.op !== 'flow') y.to = num(a.to, 0.2, 4, 1.4)
      for (const k of ['by', 'tilt', 'deg', 'amp', 'speed']) if (a[k] != null) y[k] = num(a[k], -90, 90, 1)
      if (a.color) y.color = clean(a.color, 20)
      return y }).filter((y) => y.op === 'flow' ? y.along || (y.from && y.to) : y.id)
    const l1 = look(s.look); if (l1.length) o.look = l1; else if (s.look === 'all') o.look = 'all'
    const l2 = look(s.look2); if (l2.length) o.look2 = l2
    if (VIEWS.includes(s.view)) o.view = s.view
    if (s.zoom != null) o.zoom = num(s.zoom, 0.25, 4, 1)
    if (s.name) o.name = clean(s.name, 28)
    return o }).filter((s) => s.line)
  // the last two lines are always the same shape
  const ci = steps.findIndex((s) => /^congratulations/i.test(s.line))
  if (ci >= 0) steps = steps.slice(0, ci + 1)
  const all = parts.map((p) => p.id), last = steps[steps.length - 1]
  if (last && ci >= 0) { last.look = last.look || all.filter((id) => !['person', 'guard', 'worker'].includes((parts.find((p) => p.id === id) || {}).shape)).slice(0, 12); last.view = last.view || 'high' }
  steps.push({ line: FOLLOW, show: [], hide: [], act: (last ? last.act : []).filter((a) => ['spin', 'flow', 'patrol', 'lights'].includes(a.op)), look: last && last.look, view: 'wide' })
  const setting = SETTINGS.includes(sc.setting) ? sc.setting : 'city'
  const scene = { setting, cut: num(sc.cut, -50, 200, undefined), parts, steps }
  if (sc.ground && Array.isArray(sc.ground.layers)) scene.ground = { top: MATS.includes(sc.ground.top) ? sc.ground.top : undefined, layers: sc.ground.layers.slice(0, 5).map((L) => ({ mat: MATS.includes(L && L.mat) ? L.mat : 'dirt', depth: num(L && L.depth, 0.5, 200, 10) })) }
  return { topic: clean(d.topic, 60), answer: clean(d.answer, 80), titles: (Array.isArray(d.titles) ? d.titles : []).map((t) => clean(t, 90).replace(/#\S+/g, '').trim()).filter((t) => t && !YEAR.test(t) && !BRANDS.test(t)).slice(0, 3),
    ask: /\?$/.test(clean(d.ask, 120)) ? clean(d.ask, 120) : 'What should we build next?', scene, steps: scene.steps }
}
export function checkChain(C, done = []) {
  const S = C.scene, steps = S.steps, lines = steps.map((s) => s.line), all = lines.join(' '), total = words(all)
  const congrats = steps.findIndex((s) => /^congratulations!? (you just built|now you know)/i.test(s.line))
  const body = steps.slice(0, Math.max(0, congrats))
  const silent = body.filter((s) => !s.show.length && !s.hide.length && !s.act.length).map((s, k) => k + 1)
  const blind = body.filter((s) => !s.look && !s.show.length && !s.act.some((a) => a.id)).length
  const shown = new Set(); steps.forEach((s) => s.show.forEach((id) => shown.add(id)))
  const named = body.filter((s) => s.name && !s.show.length && !s.act.length).length
  const problems = body.filter((s) => s.act.some((a) => PROBLEM_OPS.has(a.op)) || s.hideHow === 'crumble').length
  const models = S.parts.filter((p) => MODELS.includes(p.shape)).length, pieces = S.parts.length
  const long = lines.filter((l) => words(l) > 26 || words(l) < 2)
  const answerEarly = C.answer && norm(C.answer).length > 3 && lines.slice(0, Math.max(0, congrats - 2)).some((l) => norm(l).includes(norm(C.answer)))
  const repeat = done.find((d) => norm(d) && (norm(d) === norm(C.topic) || norm(d) === norm(C.answer)))
  const checks = [
    { key: 'length', ok: steps.length >= 13 && steps.length <= 22 && total >= 120 && total <= 260, note: `${steps.length} lines, ${total} words (15 to 20 lines, 150 to 230 words)` },
    { key: 'lines', ok: !long.length, note: long.length ? `${long.length} line(s) too long or too short` : 'every line is one breath' },
    { key: 'ending', ok: congrats === steps.length - 2 && congrats > 8, note: congrats >= 0 ? 'ends on “Congratulations!” and the follow line' : 'no “Congratulations! You just built…” line' },
    { key: 'problems', ok: problems >= 3, note: `${problems} problems shown on screen (3 at least: it's a chain of problems)` },
    { key: 'screen', ok: !silent.length && !named, note: silent.length ? `line(s) ${silent.join(', ')} show nothing` : named ? 'a name with nothing new to show' : 'every line builds or changes something' },
    { key: 'camera', ok: !blind, note: blind ? `${blind} line(s) with nowhere to look` : 'the camera looks at every step' },
    { key: 'detail', ok: pieces >= 18 && shown.size >= 6, note: `${pieces} parts (${models} detailed models), ${shown.size} built during the video` },
    { key: 'surprise', ok: !answerEarly, note: answerEarly ? 'the answer is given away before the end' : 'the answer stays hidden until the end' },
    { key: 'new', ok: !repeat, note: repeat ? `already made: ${repeat}` : 'a topic not done before' },
    { key: 'fiction', ok: !BRANDS.test(all) && !YEAR.test(all), note: 'no brands, no years' },
    { key: 'titles', ok: C.titles.length >= 1, note: `${C.titles.length} title(s)` },
  ]
  return { ok: checks.every((c) => c.ok), checks, words: total, seconds: Math.round(total / 2.7 + steps.length * 0.3) }
}
const CRITICAL = ['length', 'ending', 'screen', 'detail', 'new', 'titles', 'problems']

// ---------- writing one ----------
export async function doneTopics() {
  return (await q("select coalesce(script->>'topic', script->>'world') as t from yt_scripts where kind = 'story' and script->>'format' in ('chain', 'build') order by id desc limit 400")).rows.map((r) => clean(r.t, 60)).filter(Boolean)
}
export async function writeChain({ area } = {}) {
  const done = [...(await doneTopics()), 'a data centre'], n = (await one("select count(*)::int as n from yt_scripts where kind = 'story' and script->>'format' = 'chain'")).n
  const A = area || AREAS[(n * 7) % AREAS.length]
  let C = null, res = null, by = null
  for (let attempt = 0; attempt < 3; attempt++) {
    const extra = attempt && res ? `\n\nYOUR LAST ONE failed these checks; make it again and fix every one:\n${res.checks.filter((c) => !c.ok).map((c) => '- ' + c.key + ': ' + c.note).join('\n')}` : ''
    let d = null
    try { d = await askJSON({ system: SYSTEM, prompt: brief(A, done.slice(0, 150)) + extra, schema: SCHEMA, temperature: attempt ? 0.8 : 0.95, maxTokens: 16000, kind: 'write' }) } catch { d = null }
    if (!d) continue
    const c2 = shapeChain(d), r2 = checkChain(c2, done)
    if (!res || r2.checks.filter((c) => c.ok).length > res.checks.filter((c) => c.ok).length) { C = c2; res = r2; by = writtenBy(d) }
    if (res.ok) break
  }
  if (!C || res.checks.some((c) => !c.ok && CRITICAL.includes(c.key))) throw new Error(`The build didn’t pass its checks (${res ? res.checks.filter((c) => !c.ok).map((c) => c.key).join(', ') : 'no answer'}). It is written again shortly.`)
  const mode = ((await one('select yt_mode from yt_settings where id = 1')) || {}).yt_mode
  const status = mode === 'autopilot' ? (res.ok ? 'approved' : 'needs_review') : res.ok ? 'draft' : 'needs_review'
  const title = (C.titles[0] || 'You Build It').slice(0, 95)
  const web = /web|site|internet|online|search|cloud|server|data|browser|link|email|domain|app/i.test(C.topic + ' ' + C.answer)
  const pk = { title, titles: C.titles.length ? C.titles : [title], hashtags: ['shorts', 'howitworks', 'tech', 'youbuildit', 'engineering'],
    description: `${C.ask}\n\nYou build it: how the tech you use every day really works, one problem at a time. Follow for a new build every day.\n\n${web ? 'Olexweb builds websites that are fast, found on Google and easy to use: https://olexweb.com/services' : 'New tools and tech stories every day: https://olexweb.com/tools'}\n\n#shorts #howitworks #tech #youbuildit #engineering` }
  const script = { mode: 'explain', format: 'chain', real: true, topic: C.topic, answer: C.answer, area: A, voice: 'am_michael', speed: 1.05, scene: C.scene, ask: C.ask,
    scenes: C.steps.map((s, k) => ({ id: 's' + (k + 1), type: 'explain-chain', pose: 'calm', text: s.line })) }
  const row = await one(`insert into yt_scripts (idea_id, kind, status, script, package, claims, checks, seconds, writer, mention, approved_at)
      values (null, 'story', $1, $2, $3, '[]', $4, $5, $6, false, case when $1 = 'approved' then now() end) returning id, status`,
    [status, JSON.stringify(script), JSON.stringify(pk), JSON.stringify(res.checks), res.seconds, by])
  await notify('ideas', status === 'approved' ? `A new build is written: “${title}” (${C.topic}). It's made and posted by itself.` : `A new build waits for you: “${title}” (${C.topic}).`, '/admin/automation/plan').catch(() => {})
  return { id: row.id, status: row.status, format: 'chain', title, topic: C.topic }
}
