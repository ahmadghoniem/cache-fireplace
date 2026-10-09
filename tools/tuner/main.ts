// The tuner: the mod's own scene code drawn in a mock terminal, with a panel per object.
// Built into tools/tuner.html by tools/build-tuner.ts; open that file in a browser.
import { LOOK } from '../../hooks/look'
import { CHOICES, COLD_MS, POSES, THROW_MS, TONE, clock, createScene, derive, geometry, lineColumns, phase } from '../../hooks/scene'
import type { Drawn, Inputs, Look, Pose, State } from '../../hooks/scene'
import { CLAWDS, FURNACES, THROWN } from '../../hooks/sprites'

const MIN = 60_000
const FRAME_MS = 125
const DEFAULT = 0x01000000
const STORE = 'clawd-furnace-tuner'
// The engine keeps 5 columns right of the band for its [-] mark
const MARK_COLUMNS = 5
const KINDS: State['kind'][] = ['unlit', 'burning', 'cold', 'expired']

type Settings = {
  look: Look
  view: { columns: number; cell: number; theme: 'dark' | 'light'; neighbour: boolean; outline: boolean }
  clock: { ttlMin: 60 | 5; rate: number; speed: number; left: number | null }
  // Each object follows the clock until one of its controls moves
  furnace: { follow: boolean; fire: number; sparks: number; smoke: number }
  thrown: { follow: boolean; throwMs: number }
  clawd: { follow: boolean; pose: Pose; chill: number }
  weather: { follow: boolean; snow: number }
  bar: { follow: boolean; kind: State['kind']; fraction: number; value: string }
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
const DEFAULTS: Settings = {
  look: clone(LOOK),
  view: { columns: 120, cell: 9, theme: 'dark', neighbour: false, outline: true },
  clock: { ttlMin: 60, rate: 1, speed: 1, left: 35 * MIN },
  furnace: { follow: true, fire: 0.7, sparks: 0.2, smoke: 0 },
  thrown: { follow: true, throwMs: THROW_MS },
  clawd: { follow: true, pose: 'watch', chill: 0 },
  weather: { follow: true, snow: 0 },
  bar: { follow: true, kind: 'burning', fraction: 0.6, value: '35m' },
}

function load(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? 'null')
    if (!saved) return clone(DEFAULTS)
    const s = clone(DEFAULTS) as Record<string, any>
    for (const k of Object.keys(s)) s[k] = { ...s[k], ...saved[k] }
    s.look.bar = { ...DEFAULTS.look.bar, ...saved.look?.bar }
    return s as Settings
  } catch {
    return clone(DEFAULTS)
  }
}
let S = load()
const save = () => {
  S.clock.left = lastRequestAt === null ? null : remaining()
  localStorage.setItem(STORE, JSON.stringify(S))
}

// The simulated session: `now` runs at the animation's speed; the clock rate moves the last request back
let now = 1_790_000_000_000
let lastRequestAt: number | null = S.clock.left === null ? null : now - (S.clock.ttlMin * MIN - S.clock.left)
let pendingRequest: number | null = null
let throwAt: number | null = null
let isPlaying = true
const ttl = () => S.clock.ttlMin * MIN
const remaining = () => (lastRequestAt === null ? 0 : ttl() - (now - lastRequestAt))
const inputs = (): Inputs => ({ now, lastRequestAt, ttlMs: ttl(), throwAt })
const setLeft = (left: number | null) => {
  lastRequestAt = left === null ? null : now - (ttl() - left)
  pendingRequest = null
}
const coldMs = () => Math.min(COLD_MS, ttl() / 3)
// Where each phase button puts the clock
const PHASE_LEFT: Record<State['kind'], () => number | null> = {
  unlit: () => null,
  burning: () => ttl() * 0.58,
  cold: () => coldMs() * 0.4,
  expired: () => -Math.min(10 * MIN, ttl()),
}
const sendPrompt = () => {
  throwAt = now
  // The request leaves right after the prompt; the cache restarts then
  pendingRequest = now + 300
}

function effective(s: State): State {
  const o = { ...s }
  if (!S.furnace.follow) Object.assign(o, { fire: S.furnace.fire, sparks: S.furnace.sparks, smoke: S.furnace.smoke })
  if (!S.thrown.follow) o.throwMs = S.thrown.throwMs >= THROW_MS ? null : S.thrown.throwMs
  if (!S.clawd.follow) Object.assign(o, { pose: S.clawd.pose, chill: S.clawd.chill })
  if (!S.weather.follow) o.snow = S.weather.snow
  if (!S.bar.follow) Object.assign(o, { kind: S.bar.kind, fraction: S.bar.fraction, value: S.bar.value })
  return o
}

// --- Drawing cells -------------------------------------------------------------------------

const THEMES = {
  dark: { bg: '#0c0c0c', fg: '#dcdcdc', dim: '#8a8580', rule: '#3a3836' },
  light: { bg: '#faf9f5', fg: '#282828', dim: '#8a8580', rule: '#cfcac0' },
}
const css = (n: number) => '#' + (n & 0xffffff).toString(16).padStart(6, '0')

function sizeCanvas(c: HTMLCanvasElement, w: number, h: number) {
  const dpr = window.devicePixelRatio || 1
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
    c.width = Math.round(w * dpr)
    c.height = Math.round(h * dpr)
    c.style.width = `${w}px`
    c.style.height = `${h}px`
  }
  const ctx = c.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

function painter(ctx: CanvasRenderingContext2D, cw: number) {
  const ch = cw * 2
  const theme = THEMES[S.view.theme]
  ctx.font = `${Math.round(ch * 0.78)}px "Cascadia Mono", Consolas, Menlo, monospace`
  ctx.textBaseline = 'middle'
  const text = (col: number, row: number, s: string, color = theme.fg) => {
    ctx.fillStyle = color
    ;[...s].forEach((c, i) => ctx.fillText(c, (col + i) * cw, row * ch + ch / 2 + 1))
  }
  const cells = (d: Drawn, col0: number, row0: number) => {
    for (let r = 0; r < d.rows; r++) {
      for (let c = 0; c < d.columns; c++) {
        const at = (r * d.columns + c) * 3
        const cp = d.cells[at]!, fg = d.cells[at + 1]!, bg = d.cells[at + 2]!
        const x = (col0 + c) * cw, y = (row0 + r) * ch
        const fgc = fg & DEFAULT ? theme.fg : css(fg)
        if (!(bg & DEFAULT)) { ctx.fillStyle = css(bg); ctx.fillRect(x, y, cw, ch) }
        if (cp === 0x2580) { ctx.fillStyle = fgc; ctx.fillRect(x, y, cw, ch / 2) }
        else if (cp === 0x2584) { ctx.fillStyle = fgc; ctx.fillRect(x, y + ch / 2, cw, ch / 2) }
        else if (cp !== 0x20 && cp !== 0) text(col0 + c, row0 + r, String.fromCodePoint(cp), fgc)
      }
    }
  }
  return { ch, theme, text, cells }
}

// --- The mock terminal ---------------------------------------------------------------------

const term = document.getElementById('term') as HTMLCanvasElement
const scene = createScene()
let lastState: State | null = null
let lastDrawn: Drawn | null = null
let lastSize: 'full' | 'line' | null = null

const TRANSCRIPT = [
  ['> fix the failing test in parser.test.ts', 'dim'],
  ['', ''],
  ['● The test expected a trailing newline. Fixed in parser.ts:42; all 18 tests pass.', 'fg'],
  ['', ''],
] as const
// Two rows in leitstand's style, standing for another plugin's band
const NEIGHBOUR = [
  ['●', ' ctx      ', '━━━━━━━━', '──────', '   41%'],
  ['●', ' 5h       ', '━━━━', '──────────', '   27%'],
]

function frame() {
  const look = S.look
  const s = effective(derive(inputs(), look))
  const body = S.view.columns - MARK_COLUMNS
  const g = geometry(look)
  const size = body >= g.columns ? 'full' : body >= lineColumns(look) ? 'line' : null
  lastState = s
  lastSize = size
  lastDrawn = size === 'full' ? scene.frame(s, look, now) : size === 'line' ? scene.line(s, look) : null
}

function paintTerminal() {
  const cw = S.view.cell
  const cols = S.view.columns
  const d = lastDrawn
  const neighbourRows = S.view.neighbour ? NEIGHBOUR.length : 0
  const bandRows = Math.max(d?.rows ?? 0, d ? neighbourRows : 0)
  const rows = TRANSCRIPT.length + bandRows + 1 + 4
  const ctx = sizeCanvas(term, cols * cw, rows * cw * 2)
  const p = painter(ctx, cw)
  ctx.fillStyle = p.theme.bg
  ctx.fillRect(0, 0, cols * cw, rows * p.ch)

  let row = 0
  for (const [line, tone] of TRANSCRIPT) p.text(0, row++, line.slice(0, cols), tone === 'dim' ? p.theme.dim : p.theme.fg)

  const bandTop = row
  if (d) {
    const body = cols - MARK_COLUMNS
    // The band's Box lines its children up at the bottom
    if (S.view.neighbour) {
      NEIGHBOUR.forEach(([mark, label, full, empty, value], i) => {
        const r = bandTop + bandRows - neighbourRows + i
        let c = 0
        for (const [s, color] of [[mark, css(TONE.clay)], [label, p.theme.fg], [full, css(TONE.clay)], [empty, css(TONE.track)], [value, p.theme.dim]] as const) {
          p.text(c, r, s.slice(0, Math.max(0, body - d.columns - c)), color)
          c += s.length
        }
      })
    }
    const col0 = body - d.columns
    const row0 = bandTop + bandRows - d.rows
    p.cells(d, col0, row0)
    // The engine's mark, in its own columns at the band's top
    p.text(cols - 4, bandTop, '[-]', p.theme.dim)
    if (S.view.outline) {
      ctx.save()
      ctx.strokeStyle = '#4fa86b'
      ctx.setLineDash([3, 3])
      ctx.strokeRect(col0 * cw + 0.5, row0 * p.ch + 0.5, d.columns * cw - 1, d.rows * p.ch - 1)
      ctx.restore()
    }
    row += bandRows
  }
  // The prompt's marginTop: one blank row the engine always leaves
  if (S.view.outline) {
    ctx.fillStyle = S.view.theme === 'dark' ? 'rgba(79,168,107,0.10)' : 'rgba(79,168,107,0.14)'
    ctx.fillRect(0, row * p.ch, cols * cw, p.ch)
    const note = "engine's blank row"
    p.text(Math.max(0, cols - note.length - 1), row, note, '#4fa86b')
  }
  row += 1
  p.text(0, row++, '─'.repeat(cols), p.theme.rule)
  p.text(0, row, '❯ ', p.theme.fg)
  ctx.fillStyle = p.theme.fg
  ctx.fillRect(2 * cw, row * p.ch + 2, cw, p.ch - 4)
  row++
  p.text(0, row++, '─'.repeat(cols), p.theme.rule)
  p.text(2, row, '? for shortcuts', p.theme.dim)
}

// --- The four states side by side ------------------------------------------------------------

const strip = document.getElementById('strip')!
const cards = KINDS.map(kind => {
  const canvas = document.createElement('canvas')
  const card = document.createElement('div')
  card.className = 'card'
  card.title = `Set the clock to ${kind}`
  const label = document.createElement('span')
  label.textContent = kind === 'cold' ? 'cold (last 10m)' : kind
  card.append(label, canvas)
  card.onclick = () => { setLeft(PHASE_LEFT[kind]()); sync() }
  strip.append(card)
  return { kind, canvas, scene: createScene(KINDS.indexOf(kind) + 3) }
})

function paintStrip() {
  const cw = Math.max(5, Math.round(S.view.cell * 0.8))
  for (const card of cards) {
    const left = PHASE_LEFT[card.kind]()
    const inp: Inputs = { now, lastRequestAt: left === null ? null : now - (ttl() - left), ttlMs: ttl(), throwAt: null }
    const d = card.scene.frame(derive(inp, S.look), S.look, now)
    const ctx = sizeCanvas(card.canvas, d.columns * cw, d.rows * cw * 2)
    const p = painter(ctx, cw)
    ctx.fillStyle = p.theme.bg
    ctx.fillRect(0, 0, d.columns * cw, d.rows * p.ch)
    p.cells(d, 0, 0)
  }
}

// --- Controls ------------------------------------------------------------------------------

type Kid = Node | string
function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & Record<string, unknown> = {}, ...kids: Kid[]) {
  const e = document.createElement(tag)
  Object.assign(e, props)
  e.append(...kids)
  return e
}
// Each control re-reads its value every frame, so the ones following the clock move with it
const syncs: (() => void)[] = []
const sync = () => { for (const f of syncs) f() }

const panels = document.getElementById('panels')!
type Follower = { follow: boolean }
function panel(title: string, follower?: Follower, note?: string) {
  const set = el('fieldset')
  const legend = el('legend', {}, title)
  if (follower) {
    const box = el('input', { type: 'checkbox' })
    box.onchange = () => { follower.follow = box.checked; save() }
    legend.append(el('label', {}, box, ' follow clock'))
    syncs.push(() => {
      box.checked = follower.follow
      set.classList.toggle('override', !follower.follow)
    })
  }
  set.append(legend)
  if (note) set.append(el('p', { className: 'note' }, note))
  panels.append(set)
  return set
}

function slider(parent: HTMLElement, label: string, o: { min: number; max: number; step: number; get: () => number; set: (v: number) => void; show?: (v: number) => string; follower?: Follower }) {
  const input = el('input', { type: 'range', min: String(o.min), max: String(o.max), step: String(o.step) })
  const out = el('output')
  let isDragging = false
  input.onpointerdown = () => { isDragging = true }
  input.onpointerup = () => { isDragging = false }
  input.oninput = () => {
    o.set(Number(input.value))
    if (o.follower) o.follower.follow = false
    save()
    sync()
  }
  syncs.push(() => {
    const v = o.get()
    if (!isDragging) input.value = String(v)
    out.textContent = o.show ? o.show(v) : v.toFixed(2)
  })
  parent.append(el('div', { className: 'row' }, el('span', {}, label), input, out))
}

function choices<T extends string | number>(parent: HTMLElement, label: string, options: readonly T[], get: () => T, set: (v: T) => void, follower?: Follower) {
  const box = el('div', { className: 'choices' })
  const buttons = options.map(v => {
    const b = el('button', { textContent: String(v) })
    b.onclick = () => {
      set(v)
      if (follower) follower.follow = false
      save()
      sync()
    }
    box.append(b)
    return b
  })
  syncs.push(() => buttons.forEach((b, i) => b.classList.toggle('on', options[i] === get())))
  parent.append(el('div', { className: 'row' }, el('span', {}, label), box, el('span')))
}

const pct = (v: number) => `${Math.round(v * 100)}%`

// Clock
{
  const p = panel('Clock', undefined, 'Sets the cache window the way the mod sees it; every object panel follows it until you move one of its controls.')
  choices(p, 'jump to', KINDS, () => (lastState ? phase(inputs()).kind : 'unlit'), k => setLeft(PHASE_LEFT[k]()))
  slider(p, 'time left', {
    min: -30, max: 60, step: 0.25,
    get: () => (lastRequestAt === null ? 60 : remaining() / MIN),
    set: v => setLeft(v * MIN),
    show: v => (lastRequestAt === null ? 'unlit' : v >= 0 ? clock(v * MIN) : `-${clock(-v * MIN)}`),
  })
  const timeLeft = p.querySelector('input[type=range]') as HTMLInputElement
  syncs.push(() => { timeLeft.min = String(-S.clock.ttlMin / 2); timeLeft.max = String(S.clock.ttlMin); timeLeft.step = String(S.clock.ttlMin / 240) })
  choices(p, 'cache', [60, 5] as const, () => S.clock.ttlMin, v => {
    const left = lastRequestAt === null ? null : (remaining() / ttl()) * v * MIN
    S.clock.ttlMin = v
    setLeft(left)
  })
  choices(p, 'clock rate', [1, 60, 600] as const, () => S.clock.rate as 1 | 60 | 600, v => { S.clock.rate = v })
  choices(p, 'animation', [0.25, 0.5, 1, 2] as const, () => S.clock.speed as 1, v => { S.clock.speed = v })
  const play = el('button', { className: 'big' })
  play.onclick = () => { isPlaying = !isPlaying; sync() }
  const step = el('button', { textContent: 'step one frame' })
  step.onclick = () => { isPlaying = false; advance(FRAME_MS); frame(); sync() }
  syncs.push(() => { play.textContent = isPlaying ? 'pause' : 'play' })
  const send = el('button', { className: 'big', textContent: 'Send a prompt (Clawd throws)' })
  send.onclick = () => { sendPrompt(); isPlaying = true }
  p.append(send, el('div', { className: 'row' }, el('span'), play, step))
}

// Concepts
{
  const p = panel('Concepts', undefined, 'One look per state. Picking one jumps the clock to that state.')
  choices(p, 'size', CHOICES.size, () => S.look.size, v => { S.look.size = v })
  choices(p, 'burning', CHOICES.burning, () => S.look.burning, v => { S.look.burning = v; setLeft(PHASE_LEFT.burning()) })
  choices(p, 'cold', CHOICES.cold, () => S.look.cold, v => { S.look.cold = v; setLeft(PHASE_LEFT.cold()) })
  choices(p, 'expired', CHOICES.expired, () => S.look.expired, v => { S.look.expired = v; setLeft(PHASE_LEFT.expired()) })
}

// Furnace
{
  const p = panel('Furnace', S.furnace)
  choices(p, 'design', Object.keys(FURNACES), () => S.look.furnace, v => { S.look.furnace = v })
  slider(p, 'fire', { min: 0, max: 1, step: 0.01, get: () => lastState?.fire ?? 0, set: v => { hold(); S.furnace.fire = v }, show: pct, follower: S.furnace })
  slider(p, 'sparks', { min: 0, max: 1, step: 0.01, get: () => lastState?.sparks ?? 0, set: v => { hold(); S.furnace.sparks = v }, show: pct, follower: S.furnace })
  slider(p, 'smoke', { min: 0, max: 1, step: 0.01, get: () => lastState?.smoke ?? 0, set: v => { hold(); S.furnace.smoke = v }, show: pct, follower: S.furnace })
  // The first slider moved takes the others from the clock, so only it changes
  function hold() {
    if (S.furnace.follow && lastState) Object.assign(S.furnace, { fire: lastState.fire, sparks: lastState.sparks, smoke: lastState.smoke })
  }
}

// Thrown
{
  const p = panel('Thrown', S.thrown, 'Scrub the throw: crouch, lift, fly, hop back.')
  choices(p, 'object', Object.keys(THROWN), () => S.look.thrown, v => { S.look.thrown = v })
  const part = (t: number) => (t >= THROW_MS ? 'done' : t < 300 ? 'crouch' : t < 750 ? 'lift' : t < 1150 ? 'fly' : 'hop')
  slider(p, 'throw', {
    min: 0, max: THROW_MS, step: 25,
    get: () => (S.thrown.follow ? (lastState?.throwMs ?? THROW_MS) : S.thrown.throwMs),
    set: v => { S.thrown.throwMs = v },
    show: part,
    follower: S.thrown,
  })
}

// Clawd
{
  const p = panel('Clawd', S.clawd)
  choices(p, 'art', Object.keys(CLAWDS), () => S.look.clawd, v => { S.look.clawd = v })
  choices(p, 'pose', POSES, () => (S.clawd.follow ? (lastState?.pose ?? 'front') : S.clawd.pose), v => { S.clawd.pose = v; S.clawd.chill = lastState?.chill ?? 0 }, S.clawd)
  slider(p, 'chill', { min: 0, max: 1, step: 0.01, get: () => (S.clawd.follow ? (lastState?.chill ?? 0) : S.clawd.chill), set: v => { if (S.clawd.follow) S.clawd.pose = lastState?.pose ?? 'front'; S.clawd.chill = v }, show: pct, follower: S.clawd })
}

// Weather
{
  const p = panel('Weather', S.weather)
  slider(p, 'snow', { min: 0, max: 1, step: 0.01, get: () => (S.weather.follow ? (lastState?.snow ?? 0) : S.weather.snow), set: v => { S.weather.snow = v }, show: pct, follower: S.weather })
}

// Bar
{
  const p = panel('Bar', S.bar, 'Style and layout are the design; state, fill and value follow the clock.')
  choices(p, 'style', CHOICES.style, () => S.look.bar.style, v => { S.look.bar.style = v })
  choices(p, 'layout', CHOICES.layout, () => S.look.bar.layout, v => { S.look.bar.layout = v })
  choices(p, 'title', CHOICES.title, () => S.look.bar.title, v => { S.look.bar.title = v })
  choices(p, 'color', CHOICES.color, () => S.look.bar.color, v => { S.look.bar.color = v })
  slider(p, 'width', { min: 6, max: 14, step: 1, get: () => S.look.bar.width, set: v => { S.look.bar.width = v }, show: v => String(v) })
  choices(p, 'state', KINDS, () => (S.bar.follow ? (lastState?.kind ?? 'unlit') : S.bar.kind), v => { holdBar(); S.bar.kind = v }, S.bar)
  slider(p, 'fill', { min: 0, max: 1, step: 0.01, get: () => (S.bar.follow ? (lastState?.fraction ?? 0) : S.bar.fraction), set: v => { holdBar(); S.bar.fraction = v }, show: pct, follower: S.bar })
  const value = el('input', { type: 'text' })
  value.oninput = () => { holdBar(); S.bar.value = value.value; S.bar.follow = false; save() }
  syncs.push(() => { if (document.activeElement !== value) value.value = S.bar.follow ? (lastState?.value ?? '') : S.bar.value })
  p.append(el('div', { className: 'row' }, el('span', {}, 'value'), value, el('span')))
  // The first control moved takes the others from the clock, so only it changes
  function holdBar() {
    if (S.bar.follow && lastState) Object.assign(S.bar, { kind: lastState.kind, fraction: lastState.fraction, value: lastState.value })
  }
}

// View
{
  const p = panel('Terminal')
  slider(p, 'columns', { min: 30, max: 200, step: 1, get: () => S.view.columns, set: v => { S.view.columns = v }, show: v => String(v) })
  slider(p, 'zoom', { min: 5, max: 16, step: 1, get: () => S.view.cell, set: v => { S.view.cell = v }, show: v => `${v}px` })
  choices(p, 'theme', ['dark', 'light'] as const, () => S.view.theme, v => { S.view.theme = v })
  choices(p, 'neighbour', ['off', 'on'] as const, () => (S.view.neighbour ? 'on' : 'off'), v => { S.view.neighbour = v === 'on' })
  choices(p, 'outline', ['off', 'on'] as const, () => (S.view.outline ? 'on' : 'off'), v => { S.view.outline = v === 'on' })
  const size = el('p', { className: 'note' })
  syncs.push(() => {
    const g = geometry(S.look)
    size.textContent = lastSize === 'full'
      ? `Scene: ${g.columns} x ${g.rows} cells (the first version was 53 x 8).`
      : lastSize === 'line' ? `Too narrow for the scene (needs ${g.columns + MARK_COLUMNS} columns): one line.` : 'Too narrow: the mod draws nothing.'
  })
  p.append(size, el('p', { className: 'note' }, 'neighbour: another plugin in the band (leitstand style); the furnace keeps to its own columns on the right.'))
}

// Export
{
  const p = panel('Export', undefined, 'Copy this and paste it to Claude, or over hooks/look.ts.')
  const area = el('textarea', { readOnly: true })
  const copy = el('button', { textContent: 'Copy look.ts' })
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(area.value)
    } catch {
      area.select()
      document.execCommand('copy')
    }
    copy.textContent = 'Copied'
    setTimeout(() => { copy.textContent = 'Copy look.ts' }, 1200)
  }
  const follow = el('button', { textContent: 'Follow clock everywhere' })
  follow.onclick = () => { for (const f of [S.furnace, S.thrown, S.clawd, S.weather, S.bar]) f.follow = true; save(); sync() }
  const reset = el('button', { textContent: 'Reset all' })
  reset.onclick = () => { localStorage.removeItem(STORE); S = clone(DEFAULTS); location.reload() }
  syncs.push(() => { area.value = lookTs(S.look) })
  p.append(area, el('div', { className: 'choices' }, copy, follow, reset))
}

function lookTs(l: Look) {
  const q = (s: string) => `'${s}'`
  return [
    '// The design the mod draws. tools/tuner.html picks one and its Export button copies it here.',
    "import type { Look } from './scene'",
    '',
    'export const LOOK: Look = {',
    `  size: ${l.size},`,
    `  clawd: ${q(l.clawd)},`,
    `  furnace: ${q(l.furnace)},`,
    `  thrown: ${q(l.thrown)},`,
    `  burning: ${q(l.burning)},`,
    `  cold: ${q(l.cold)},`,
    `  expired: ${q(l.expired)},`,
    `  bar: { style: ${q(l.bar.style)}, width: ${l.bar.width}, layout: ${q(l.bar.layout)}, title: ${q(l.bar.title)}, color: ${q(l.bar.color)} },`,
    '}',
    '',
  ].join('\n')
}

// --- Running --------------------------------------------------------------------------------

function advance(ms: number) {
  now += ms
  // Faster than real time for the cache window only: the animation keeps its pace
  if (lastRequestAt !== null) lastRequestAt -= ms * (S.clock.rate - 1)
  if (pendingRequest !== null && now >= pendingRequest) {
    lastRequestAt = pendingRequest
    pendingRequest = null
  }
}

const status = document.getElementById('status')!
let acc = 0
let then = performance.now()
let saveAt = 0
function loop(t: number) {
  const dt = Math.min(500, t - then)
  then = t
  if (isPlaying) acc += dt * S.clock.speed
  let ticks = 0
  while (acc >= FRAME_MS && ticks < 4) {
    acc -= FRAME_MS
    advance(FRAME_MS)
    frame()
    ticks++
  }
  if (acc > FRAME_MS) acc = 0
  if (ticks || !lastState) {
    if (!lastState) frame()
    paintTerminal()
    paintStrip()
    sync()
    const ph = phase(inputs())
    status.textContent = ph.kind === 'unlit' ? 'unlit: no request yet'
      : ph.kind === 'expired' ? `expired ${clock(ph.since)} ago`
      : `${ph.kind === 'cold' ? 'cold' : 'burning'}: ${clock(ph.remaining)} left of ${S.clock.ttlMin}m`
    if (t > saveAt) { save(); saveAt = t + 1000 }
  }
}

window.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (e.key === 'p') sendPrompt()
  else if (e.key === ' ') { isPlaying = !isPlaying; e.preventDefault() }
  else if (e.key === '.') { isPlaying = false; advance(FRAME_MS); frame(); paintTerminal(); paintStrip(); sync() }
  else return
  sync()
})

frame()
paintTerminal()
paintStrip()
sync()
setInterval(() => loop(performance.now()), 25)
