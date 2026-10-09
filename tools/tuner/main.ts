// The viewer: the mod's own scene code in a mock terminal. One live band to scrub and
// send prompts to, and every state side by side under it.
// Built into tools/tuner.html by tools/build-tuner.ts; open that file in a browser.
import { COLUMNS, ROW_COLUMNS, THROW_MS, TTL_MS, derive, frame, isColdStart, line } from '../../hooks/scene'
import type { Drawn, Inputs } from '../../hooks/scene'

const MIN = 60_000
const FRAME_MS = 125
const DEFAULT = 0x01000000
// The engine keeps 5 columns right of the band for its [-] mark
const MARK_COLUMNS = 5
const T0 = 1_790_000_000_000

const THEMES = {
  dark: { bg: '#0c0c0c', fg: '#dcdcdc', dim: '#8a8580', rule: '#3a3836' },
  light: { bg: '#faf9f5', fg: '#282828', dim: '#8a8580', rule: '#cfcac0' },
}
type Theme = keyof typeof THEMES
let theme: Theme = localStorage.getItem('clawd-fireplace-theme') === 'light' ? 'light' : 'dark'
const css = (n: number) => '#' + (n & 0xffffff).toString(16).padStart(6, '0')

// Braille cells, as a terminal font draws them: dots on a 2 x 4 grid. Bit i is dot i + 1
const BRAILLE_DOTS = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [0, 3], [1, 3]] as const

const dpr = () => window.devicePixelRatio || 1
// Edges on whole device pixels, so neighbouring cells meet with no seam between them
const snap = (v: number) => Math.round(v * dpr()) / dpr()
const rect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) =>
  ctx.fillRect(snap(x), snap(y), snap(x + w) - snap(x), snap(y + h) - snap(y))

function size(canvas: HTMLCanvasElement, w: number, h: number) {
  const dpr = window.devicePixelRatio || 1
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`
  }
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = THEMES[theme].bg
  ctx.fillRect(0, 0, w, h)
  ctx.textBaseline = 'middle'
  return ctx
}

function cells(ctx: CanvasRenderingContext2D, d: Drawn, col0: number, row0: number, cw: number) {
  const ch = cw * 2
  ctx.font = `${Math.round(ch * 0.72)}px "Cascadia Mono", Consolas, Menlo, "Segoe UI Symbol", monospace`
  for (let r = 0; r < d.rows; r++) {
    for (let c = 0; c < d.columns; c++) {
      const at = (r * d.columns + c) * 3
      const cp = d.cells[at]!, fg = d.cells[at + 1]!, bg = d.cells[at + 2]!
      const x = (col0 + c) * cw, y = (row0 + r) * ch
      if (!(bg & DEFAULT)) { ctx.fillStyle = css(bg); rect(ctx, x, y, cw, ch) }
      ctx.fillStyle = fg & DEFAULT ? THEMES[theme].fg : css(fg)
      if (cp === 0x2580) rect(ctx, x, y, cw, ch / 2)
      else if (cp === 0x2584) rect(ctx, x, y + ch / 2, cw, ch / 2)
      else if (cp >= 0x2800 && cp <= 0x28ff) {
        const r = cw * 0.13
        BRAILLE_DOTS.forEach(([i, j], bit) => {
          if (!((cp - 0x2800) & (1 << bit))) return
          ctx.beginPath()
          ctx.arc(x + cw * (0.3 + 0.4 * i), y + ch * (0.17 + 0.22 * j), r, 0, Math.PI * 2)
          ctx.fill()
        })
      } else if (cp !== 0x20 && cp !== 0) ctx.fillText(String.fromCodePoint(cp), x, y + ch / 2 + 1)
    }
  }
}

// What the band draws in a terminal `width` columns wide, as register.tsx decides it
function band(inp: Inputs, width: number): Drawn | null {
  const room = width - MARK_COLUMNS
  if (room >= COLUMNS) return frame(derive(inp), inp.now)
  if (room >= ROW_COLUMNS) return line(derive(inp))
  return null
}

// --- The live band ---------------------------------------------------------------------

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const live = $<HTMLCanvasElement>('live')
const left = $<HTMLInputElement>('left')
const leftOut = $<HTMLOutputElement>('leftOut')
const widthIn = $<HTMLInputElement>('width')
const widthOut = $<HTMLOutputElement>('widthOut')
const speedIn = $<HTMLSelectElement>('speed')
const status = $('status')

let now = T0
let lastRequestAt: number | null = now - 25 * MIN
let pendingRequest: number | null = null
let throwAt: number | null = null
let pokeAt: number | null = null
let isPlaying = true

left.oninput = () => {
  lastRequestAt = now - (TTL_MS - Number(left.value) * MIN)
  pendingRequest = null
}
$('unlit').onclick = () => { lastRequestAt = null; pendingRequest = null }
const send = () => {
  // As register.tsx decides: a log on a cold cache, a poke on a warm one
  if (isColdStart(now, lastRequestAt)) throwAt = now
  else pokeAt = now
  // The request goes out just after the prompt; the cache restarts then
  pendingRequest = now + 200
}
$('send').onclick = send
const togglePlay = () => { isPlaying = !isPlaying; $('play').textContent = isPlaying ? 'pause' : 'play' }
$('play').onclick = togglePlay
const setTheme = (t: Theme) => { theme = t; document.body.dataset.theme = t; localStorage.setItem('clawd-fireplace-theme', t) }
$('theme').onclick = () => setTheme(theme === 'dark' ? 'light' : 'dark')
setTheme(theme)
document.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
  if (e.key === 'p') send()
  else if (e.key === ' ') { e.preventDefault(); togglePlay() }
})

function drawLive() {
  const cw = 9, ch = cw * 2
  const width = Number(widthIn.value)
  widthOut.value = `${width} cols`
  const inp = { now, lastRequestAt, throwAt, pokeAt }
  const d = band(inp, width)
  const t = THEMES[theme]
  const bandRows = d?.rows ?? 0
  // A transcript line, the band, the composer between its rules
  const ctx = size(live, width * cw, (bandRows + 5) * ch)
  ctx.font = `${Math.round(ch * 0.72)}px "Cascadia Mono", Consolas, Menlo, monospace`
  ctx.fillStyle = t.dim
  ctx.fillText('⏺ the transcript ends here', 0, ch / 2)
  if (d) {
    cells(ctx, d, width - MARK_COLUMNS - d.columns, 1, cw)
    ctx.fillStyle = t.dim
    ctx.fillText('[-]', (width - 4) * cw, (bandRows + 0.5) * ch)
  }
  const rule = (r: number) => { ctx.fillStyle = t.rule; ctx.fillRect(0, (r + 0.5) * ch, width * cw, 1) }
  rule(bandRows + 2)
  ctx.fillStyle = t.fg
  ctx.fillText('❯', cw, (bandRows + 3.5) * ch)
  rule(bandRows + 4)

  const s = derive(inp)
  const m = lastRequestAt === null ? null : (TTL_MS - (now - lastRequestAt)) / MIN
  leftOut.value = m === null ? 'unlit' : `${m.toFixed(1)}m`
  if (m !== null && document.activeElement !== left) left.value = String(m)
  status.textContent = `${s.kind} · ${s.value}${d ? '' : ' · too narrow, nothing drawn'}${d && d.rows === 1 ? ' · the row alone' : ''}`
}

// --- Every state at once ---------------------------------------------------------------

// A shot with `act` replays a prompt on a loop; one without holds its time left while the clock runs
type Shot = { title: string; lastAgo: number | null; act?: 'throw' | 'poke' }
const SHOTS: Shot[] = [
  { title: 'unlit, first prompt: a log', lastAgo: null, act: 'throw' },
  { title: 'burning, 50m left', lastAgo: 10 * MIN },
  { title: 'prompt at 40m left: a poke', lastAgo: 20 * MIN, act: 'poke' },
  { title: 'burning, 25m left', lastAgo: 35 * MIN },
  { title: 'cold, 15m left', lastAgo: 45 * MIN },
  { title: 'cold, 4m left: flickers every 30 s', lastAgo: 56 * MIN },
  { title: 'expired', lastAgo: 70 * MIN },
  { title: 'expired, prompt: a log', lastAgo: 70 * MIN, act: 'throw' },
]
// The prompts replay on this loop
const LOOP_MS = THROW_MS + 2000
const gallery = $('gallery')
const shotCanvases = SHOTS.map(s => {
  const card = document.createElement('div')
  card.className = 'card'
  const label = document.createElement('span')
  label.textContent = s.title
  const c = document.createElement('canvas')
  card.append(label, c)
  gallery.append(card)
  return c
})

function drawGallery(clock: number) {
  const cw = 6
  SHOTS.forEach((s, i) => {
    const t = clock % LOOP_MS
    const at = T0 + (s.act ? t : clock)
    // As in tools/preview.ts: a prompt's request goes out right after it is sent
    const last = s.act && t > 200 ? T0 + 200 : s.lastAgo === null ? null : at - (s.act ? t : 0) - s.lastAgo
    const d = frame(derive({ now: at, lastRequestAt: last, throwAt: s.act === 'throw' ? T0 : null, pokeAt: s.act === 'poke' ? T0 : null }), at)
    cells(size(shotCanvases[i]!, d.columns * cw, d.rows * cw * 2), d, 0, 0, cw)
  })
}

// --- The clock ---------------------------------------------------------------------------

let galleryClock = 0
// setInterval, not requestAnimationFrame: it runs in a hidden tab and headless too
setInterval(() => {
  if (isPlaying) {
    // A throw or poke plays at 1x whatever the speed, so it can be watched
    const isActing = [throwAt, pokeAt].some(at => at !== null && now - at < THROW_MS + 500)
    now += FRAME_MS * (isActing ? 1 : Number(speedIn.value))
    galleryClock += FRAME_MS
    if (pendingRequest !== null && now >= pendingRequest) { lastRequestAt = pendingRequest; pendingRequest = null }
  }
  drawLive()
  drawGallery(galleryClock)
}, FRAME_MS)
