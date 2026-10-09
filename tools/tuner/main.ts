// The viewer: the mod's own scene code in a mock terminal. One live band to scrub and
// send prompts to, and every state side by side under it.
// Built into tools/tuner.html by tools/build-tuner.ts; open that file in a browser.
import { COLUMNS, ROWS, ROW_COLUMNS, THROW_MS, derive, frame, line } from '../../hooks/scene'
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

// The shade glyphs as the dot patterns a terminal font draws, not the canvas font's blocks
const SHADES: Record<number, number> = { 0x2591: 0.25, 0x2592: 0.5, 0x2593: 0.75 }
const BAYER = [[0, 2], [3, 1]]

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
      if (!(bg & DEFAULT)) { ctx.fillStyle = css(bg); ctx.fillRect(x, y, cw, ch) }
      ctx.fillStyle = fg & DEFAULT ? THEMES[theme].fg : css(fg)
      const shade = SHADES[cp]
      if (cp === 0x2580) ctx.fillRect(x, y, cw, ch / 2)
      else if (cp === 0x2584) ctx.fillRect(x, y + ch / 2, cw, ch / 2)
      else if (shade !== undefined) {
        const dot = Math.max(1, Math.round(cw / 4.5))
        for (let j = 0; j * dot < ch; j++) {
          for (let i = 0; i * dot < cw; i++) {
            if (BAYER[j % 2]![i % 2]! / 4 < shade) ctx.fillRect(x + i * dot, y + j * dot, dot, dot)
          }
        }
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
const ttlIn = $<HTMLSelectElement>('ttl')
const speedIn = $<HTMLSelectElement>('speed')
const status = $('status')

let now = T0
let ttlMs = 60 * MIN
let lastRequestAt: number | null = now - 25 * MIN
let pendingRequest: number | null = null
let throwAt: number | null = null
let isPlaying = true

left.oninput = () => {
  lastRequestAt = now - (ttlMs - Number(left.value) * MIN)
  pendingRequest = null
}
ttlIn.onchange = () => {
  ttlMs = Number(ttlIn.value) * MIN
  left.min = String(-ttlMs / MIN / 4)
  left.max = String(ttlMs / MIN)
  lastRequestAt = now - ttlMs / 2
}
$('unlit').onclick = () => { lastRequestAt = null; pendingRequest = null }
const send = () => {
  throwAt = now
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
  const inp = { now, lastRequestAt, ttlMs, throwAt }
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
  const m = lastRequestAt === null ? null : (ttlMs - (now - lastRequestAt)) / MIN
  leftOut.value = m === null ? 'unlit' : `${m.toFixed(1)}m`
  if (m !== null && document.activeElement !== left) left.value = String(m)
  status.textContent = `${s.kind} · ${s.value}${d ? '' : ' · too narrow, nothing drawn'}${d && d.rows === 1 ? ' · the row alone' : ''}`
}

// --- Every state at once ---------------------------------------------------------------

type Shot = { title: string; lastAgo: number | null; isThrow?: boolean }
const SHOTS: Shot[] = [
  { title: 'unlit, first prompt', lastAgo: null, isThrow: true },
  { title: 'burning, 50m left', lastAgo: 10 * MIN },
  { title: 'burning, 20m left', lastAgo: 40 * MIN },
  { title: 'prompt at 20m left', lastAgo: 40 * MIN, isThrow: true },
  { title: 'cooling, 6m left', lastAgo: 54 * MIN },
  { title: 'cooling, 1m left', lastAgo: 59 * MIN },
  { title: 'expired', lastAgo: 70 * MIN },
]
// The throws replay on this loop
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
    const at = T0 + t
    // As in tools/preview.ts: a prompt's request goes out right after it is sent
    const last = s.isThrow && t > 200 ? T0 + 200 : s.lastAgo === null ? null : T0 - s.lastAgo
    const d = frame(derive({ now: at, lastRequestAt: last, ttlMs: 60 * MIN, throwAt: s.isThrow ? T0 : null }), at)
    cells(size(shotCanvases[i]!, d.columns * cw, d.rows * cw * 2), d, 0, 0, cw)
  })
}

// --- The clock ---------------------------------------------------------------------------

let galleryClock = 0
// setInterval, not requestAnimationFrame: it runs in a hidden tab and headless too
setInterval(() => {
  if (isPlaying) {
    // A throw plays at 1x whatever the speed, so it can be watched
    const isThrowing = throwAt !== null && now - throwAt < THROW_MS + 500
    now += FRAME_MS * (isThrowing ? 1 : Number(speedIn.value))
    galleryClock += FRAME_MS
    if (pendingRequest !== null && now >= pendingRequest) { lastRequestAt = pendingRequest; pendingRequest = null }
  }
  drawLive()
  drawGallery(galleryClock)
}, FRAME_MS)
