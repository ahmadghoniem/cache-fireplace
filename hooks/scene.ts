// The fireplace scene, drawn into Raster cells. Pure, and a function of the clock alone:
// the same inputs draw the same frame, so the tuner and tools/preview show any moment.
import { BED, CLAWD, FIREPLACE, LOG, LOGS_ROW, PAL, PUFFS, SCARF, TIPS, WOODPILE, artWidth, shut } from './sprites'
import type { Art } from './sprites'

export const COLD_MS = 10 * 60 * 1000

// The throw, in ms after the prompt was sent
const T_PICK = 375
const T_LIFT = 750
const T_RELEASE = 1000
export const T_IMPACT = 1375
export const THROW_MS = 2000

// The cooking scene's pace: its flames change every 160 ms
const FLAME_MS = 160
const DEFAULT = 0x01000000
const NONE = -1
// leitstand's colors; the track is its #8a8580 drawn dim
export const TONE = { clay: 0xd97757, warn: 0xd08a1e, bad: 0xd9534f, track: 0x5f5c58, dim: 0x8a8580 }

export type Inputs = {
  now: number
  // When the main loop last sent a request: the cache was written or read then
  lastRequestAt: number | null
  ttlMs: number
  // When the person last sent a prompt: Clawd throws a log on
  throwAt: number | null
}

export type Phase =
  | { kind: 'unlit' }
  | { kind: 'burning'; remaining: number }
  | { kind: 'cold'; remaining: number; cold: number }
  | { kind: 'expired'; since: number }
export type Kind = Phase['kind']

// What a frame draws; the tuner can set any of it by hand
export type State = {
  kind: Kind
  // The fire, 0..1 (a fresh log flares it)
  fire: number
  // 0..1 through the cold stretch: the embers go out one by one
  cold: number
  // ms into the throw, null when Clawd is not throwing
  throwMs: number | null
  // The bar
  fraction: number
  value: string
}

// The last 10 minutes are cold; with a short cache (5 minutes on the API) the last third
const coldMs = (ttlMs: number) => Math.min(COLD_MS, ttlMs / 3)

export function phase({ now, lastRequestAt, ttlMs }: Inputs): Phase {
  if (lastRequestAt === null) return { kind: 'unlit' }
  const remaining = ttlMs - (now - lastRequestAt)
  if (remaining <= 0) return { kind: 'expired', since: -remaining }
  if (remaining < coldMs(ttlMs)) return { kind: 'cold', remaining, cold: 1 - remaining / coldMs(ttlMs) }
  return { kind: 'burning', remaining }
}

// How high the fire burns while the cache is warm: 1 fresh, 0.4 as the cold stretch begins
export function intensity(p: Phase, ttlMs: number): number {
  if (p.kind !== 'burning') return 0
  const cold = coldMs(ttlMs)
  return 0.4 + 0.6 * ((p.remaining - cold) / Math.max(1, ttlMs - cold))
}

export function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  if (s >= 600) return `${Math.ceil(s / 60)}m`
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const mix = (c1: number, c2: number, t: number) => {
  const ch = (s: number) => Math.round(lerp((c1 >> s) & 255, (c2 >> s) & 255, t)) << s
  return ch(16) | ch(8) | ch(0)
}
// A fixed scatter from two numbers, 0..1
const hash = (a: number, b: number) => {
  let t = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)
  t ^= t >>> 15
  t = Math.imul(t, 0x2c1b3c6d)
  return ((t ^ (t >>> 13)) >>> 0) / 4294967296
}

export function derive(inp: Inputs): State {
  const p = phase(inp)
  const since = inp.throwAt === null ? Infinity : inp.now - inp.throwAt
  const throwMs = since >= 0 && since < THROW_MS ? since : null
  // A fresh log flares up, then settles to what the clock says
  const flare = since >= T_IMPACT ? 0.8 * Math.exp(-(since - T_IMPACT) / 1600) : 0
  const s: State = { kind: p.kind, fire: clamp(intensity(p, inp.ttlMs) + flare), cold: 0, throwMs, fraction: 0, value: '' }
  if (p.kind === 'burning') {
    s.fraction = p.remaining / inp.ttlMs
    s.value = clock(p.remaining)
  } else if (p.kind === 'cold') {
    s.cold = p.cold
    s.fraction = p.remaining / inp.ttlMs
    s.value = clock(p.remaining)
  } else if (p.kind === 'expired') {
    s.value = 'out'
  } else {
    s.value = '–'
  }
  return s
}

// --- The bar: one of leitstand's rows -----------------------------------------------------

// leitstand's loud meter (hooks/bars.ts): a halftone body that fades at its edge, then a dotted track
const FULL = '▓'
const RAMP = ['░', '░', '▒', '▓']
const fill = (pct: number, width: number) => Math.max(0, Math.min(width, Math.round((pct / 100) * width)))
export function loudMeter(pct: number, width: number): [string, string] {
  const n = fill(pct, width)
  const fade = n === width ? [] : [...RAMP].reverse().slice(0, Math.min(2, n))
  return [FULL.repeat(n - fade.length) + fade.join(''), '·'.repeat(width - n)]
}

const fit = (s: string, w: number) => (s.length > w ? s.slice(0, w) : s.padEnd(w))
// mark and state, the name, the bar, the value: as leitstand lays out a row
export const ROW = { state: 9, name: 6, bar: 12, value: 4 }
export const ROW_COLUMNS = 2 + ROW.state + ROW.name + ROW.bar + 1 + ROW.value
const MARK: Record<Kind, [string, string, number]> = {
  unlit: ['·', 'unlit', TONE.dim],
  burning: ['✱', 'burning', TONE.clay],
  cold: ['!', 'cooling', TONE.warn],
  expired: ['!', 'expired', TONE.bad],
}

// The row as runs of text and color
export function row(s: State): [string, number][] {
  const [mark, word, tone] = MARK[s.kind]
  const [body, rest] = loudMeter(s.fraction * 100, ROW.bar)
  return [
    [`${mark} ${fit(word, ROW.state)}`, tone],
    [fit('cache', ROW.name), DEFAULT],
    [body, tone],
    [rest, TONE.track],
    [` ${s.value.padStart(ROW.value)}`, TONE.dim],
  ]
}

// --- The scene ---------------------------------------------------------------------------

// Where everything sits, in pixels; two pixel rows to a terminal row
export const STAGE = (() => {
  const pileX = 18
  const fireX = pileX + artWidth(WOODPILE)
  const w = fireX + artWidth(FIREPLACE)
  const h = FIREPLACE.length
  return { w, h, clawdX: 0, clawdY: h - 1 - CLAWD.stand.length, pileX, pileY: h - 1 - WOODPILE.length, fireX }
})()
const GAP = 2
export const COLUMNS = ROW_COLUMNS + GAP + STAGE.w
export const ROWS = STAGE.h / 2

export type Drawn = { cells: Uint32Array; columns: number; rows: number }

export function frame(s: State, now: number): Drawn {
  const { w, h } = STAGE
  const px = new Int32Array(w * h).fill(NONE)
  const put = (x: number, y: number, c: number) => {
    x = Math.round(x); y = Math.round(y)
    if (x >= 0 && y >= 0 && x < w && y < h) px[y * w + x] = c
  }
  const sprite = (art: Art, x: number, y: number, color = (ch: string): number | undefined => PAL[ch]) => {
    art.forEach((line, j) => {
      for (let i = 0; i < line.length; i++) {
        const c = color(line[i]!)
        if (c !== undefined) put(x + i, y + j, c)
      }
    })
  }
  const tick = Math.floor(now / FLAME_MS)

  // The floor Clawd and the woodpile stand on, up to the hearth
  for (let x = 0; x < STAGE.fireX; x++) put(x, h - 1, PAL.G!)
  sprite(WOODPILE, STAGE.pileX, STAGE.pileY)
  drawFireplace(s, tick, sprite, put)
  drawClawd(s, now, sprite)

  // Text left of the stage on the bottom row, half-blocks after it
  const cells = new Uint32Array(COLUMNS * ROWS * 3).fill(0)
  for (let i = 0; i < COLUMNS * ROWS; i++) { cells[i * 3] = 0x20; cells[i * 3 + 1] = DEFAULT; cells[i * 3 + 2] = DEFAULT }
  let col = 0
  for (const [text, fg] of row(s)) {
    for (const ch of text) {
      const at = ((ROWS - 1) * COLUMNS + col++) * 3
      cells[at] = ch.codePointAt(0)!; cells[at + 1] = fg
    }
  }
  for (let r = 0; r < ROWS; r++) {
    for (let x = 0; x < w; x++) {
      const at = (r * COLUMNS + ROW_COLUMNS + GAP + x) * 3
      const top = px[r * 2 * w + x]!
      const bottom = px[(r * 2 + 1) * w + x]!
      if (top === NONE && bottom === NONE) continue
      if (bottom === NONE) { cells[at] = 0x2580; cells[at + 1] = top }
      else if (top === NONE) { cells[at] = 0x2584; cells[at + 1] = bottom }
      else { cells[at] = 0x2580; cells[at + 1] = top; cells[at + 2] = bottom }
    }
  }
  return { cells, columns: COLUMNS, rows: ROWS }
}

type Sprite = (art: Art, x: number, y: number, color?: (ch: string) => number | undefined) => void
type Put = (x: number, y: number, c: number) => void

// The fireplace tells the state: flames by height, then embers, then ash and smoke
function drawFireplace(s: State, tick: number, sprite: Sprite, put: Put) {
  const fx = STAGE.fireX
  const lit = s.kind === 'burning' || s.fire > 0
  // Firebrick and the hearth in front take the fire's glow
  const glow = lit ? 0.25 + 0.45 * s.fire : s.kind === 'cold' ? 0.18 * (1 - s.cold) : 0
  sprite(FIREPLACE, fx, 0, ch => {
    if (ch === 'k') return mix(PAL.k!, 0x8a3a22, glow)
    if (ch === 'D') return mix(PAL.D!, 0x4a1e10, glow * 0.6)
    return PAL[ch]
  })
  for (let x = BED.x - 1; x < BED.x + BED.w + 1; x++) put(fx + x, 10, mix(PAL.R!, 0xf59e0b, glow * 0.45))

  const x0 = fx + BED.x
  if (lit) {
    // Two rows as the cooking scene has them, more while the fire is high
    const rows = s.fire >= 0.9 ? 4 : s.fire >= 0.7 ? 3 : 2
    for (let r = 0; r < rows; r++) {
      const y = BED.y - r
      // Each row up is narrower and sparser; the top row is the cooking scene's tips
      const inset = r === 0 ? 0 : Math.min(4, r + 1)
      for (let i = inset; i < BED.w - inset; i++) {
        let ch: string
        if (r === 0) ch = (i + tick) % 2 === 0 ? 'F' : 'f'
        else if (r === rows - 1) ch = TIPS[(tick + r * 5) % TIPS.length]![i]!
        else ch = hash(tick, r * 16 + i) < 0.7 ? ((i + tick + r) % 2 === 0 ? 'F' : 'y') : '.'
        if (ch !== '.') put(x0 + i, y, PAL[ch]!)
      }
    }
    // Sparks up the flue from a fresh log
    if (s.fire > 0.9) {
      for (let k = 0; k < 3; k++) {
        if (hash(tick, 100 + k) < 0.5) put(x0 + 2 + Math.floor(hash(tick, 200 + k) * (BED.w - 4)), BED.y - rows - Math.floor(hash(tick, 300 + k) * 2), PAL.y!)
      }
    }
    return
  }
  if (s.kind === 'cold') {
    // Embers on the logs, fewer as the cold stretch runs out, and a thread of smoke
    for (let i = 0; i < BED.w; i++) {
      if (hash(i, 7) < 0.75 - 0.6 * s.cold) put(x0 + i, LOGS_ROW, PAL[(i + tick) % 3 === 0 ? 'F' : 'f']!)
    }
    smoke(x0 + 5, 0.5, tick, sprite)
    return
  }
  if (s.kind === 'expired') {
    for (let i = 0; i < BED.w; i++) if (i % 6 !== 5) put(x0 + i, LOGS_ROW, PAL.a!)
    smoke(x0 + 4, 1, tick, sprite)
  }
}

// A puff rising from the logs into the flue, every 16 ticks
function smoke(x: number, strength: number, tick: number, sprite: Sprite) {
  const t = tick % 16
  if (t >= 10) return
  const y = LOGS_ROW - 1 - Math.floor(t / 2)
  if (y < 3) return
  const puff = PUFFS[Math.min(PUFFS.length - 1, Math.floor(t / 4))]!
  const color = mix(PAL.D!, PAL.s!, strength * (1 - t / 14))
  sprite(puff, x + (t >> 2), y - puff.length + 1, ch => (ch === 's' ? color : undefined))
}

function drawClawd(s: State, now: number, sprite: Sprite) {
  const { clawdX: x, clawdY: y } = STAGE
  if (s.throwMs !== null) return drawThrow(Math.floor(s.throwMs / 125) * 125, sprite)
  const isBlink = now % 4100 < 160
  // Now and then he looks out of the band
  const isFront = now % 17000 > 15200
  const art = isFront ? CLAWD.front : CLAWD.stand
  sprite(isBlink ? shut(art) : art, x, y)
  // Low fire or none: a scarf
  if (s.kind === 'cold' || s.kind === 'expired') sprite(SCARF, x, y)
}

function drawThrow(t: number, sprite: Sprite) {
  const { clawdX: x, clawdY: y, fireX } = STAGE
  if (t < T_PICK) {
    sprite(CLAWD.crouch, x, y)
  } else if (t < T_LIFT) {
    sprite(CLAWD.stand, x, y)
    sprite(LOG, x + 14, y + 3)
  } else if (t < T_RELEASE) {
    sprite(CLAWD.toss, x, y)
    sprite(LOG, x + 16, y)
  } else if (t < T_IMPACT) {
    // The log goes forward and drops into the fire
    const k = (t - T_RELEASE) / (T_IMPACT - T_RELEASE)
    sprite(k < 0.5 ? CLAWD.toss : CLAWD.stand, x, y)
    sprite(LOG, lerp(x + 16, fireX + BED.x + 4, k), lerp(y, BED.y, k * k))
  } else {
    // A hop at the flare
    const k = (t - T_IMPACT) / (THROW_MS - T_IMPACT)
    if (k < 0.4) sprite(shut(CLAWD.hop), x, y - 1)
    else sprite(CLAWD.stand, x, y)
  }
}

// One row for a narrow terminal: the bar alone
export function line(s: State): Drawn {
  const cells = new Uint32Array(ROW_COLUMNS * 3)
  let c = 0
  for (const [text, fg] of row(s)) {
    for (const ch of text) {
      cells[c * 3] = ch.codePointAt(0)!; cells[c * 3 + 1] = fg; cells[c * 3 + 2] = DEFAULT
      c++
    }
  }
  return { cells, columns: ROW_COLUMNS, rows: 1 }
}

export function toBase64(cells: Uint32Array): string {
  // Little-endian words, as RasterProps asks. The environment has toBase64; lib es2023 does not type it
  const bytes = new Uint8Array(cells.buffer, cells.byteOffset, cells.byteLength) as Uint8Array & { toBase64(): string }
  return bytes.toBase64()
}
