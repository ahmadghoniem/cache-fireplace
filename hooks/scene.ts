// The fireplace scene, drawn into Raster cells. Pure, and a function of the clock alone:
// the same inputs draw the same frame, so the tuner and tools/preview show any moment.
import { BED, CLAWD, FIREPLACE, LOG, LOGS_ROW, PAL, PUFFS, SCARF, SIDE_W, TIPS, artWidth, shut, turned } from './sprites'
import type { Art } from './sprites'

const MIN = 60_000
// The prompt cache lasts an hour
export const TTL_MS = 60 * MIN
// From 20 minutes left Clawd is cold: scarf on, rubbing his hands, the fire down to embers
export const COLD_MS = 20 * MIN
// From 5 minutes left the bar's last segment flickers, like a battery about to run out
export const LOW_MS = 5 * MIN
const FLICKER_EVERY_MS = 30_000
const FLICKER_MS = 1500

// The throw, after a prompt to a cold cache: walk to the woodpile, pick a log, toss it in, walk back.
// In ms after the prompt was sent
const T_WALK = 500
const T_PICK = 750
const T_LIFT = 1000
const T_RELEASE = 1250
export const T_IMPACT = 1625
const T_TURN = 1875
const T_BACK = 2000
export const THROW_MS = 2750

// The poke, after a prompt to a warm cache: step up, stoke the fire twice, step back
const P_REACH = 250
const P_JABS = [500, 1000]
const P_JAB_MS = 250
const P_DONE = 1500
export const POKE_MS = 1750

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
  // When the person last sent a prompt to a cold cache: Clawd throws a log on
  throwAt: number | null
  // When the person last sent a prompt to a warm cache: Clawd pokes the fire
  pokeAt: number | null
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
  // The fire, 0..1 (a fresh log flares it, a poke less so)
  fire: number
  // 0..1 through the cold stretch: the embers go out one by one
  cold: number
  // ms into the throw or the poke, null when Clawd is not doing it
  throwMs: number | null
  pokeMs: number | null
  // The poker is in the fire: sparks fly
  isStoked: boolean
  // The bar
  fraction: number
  value: string
  // The bar's last segment, blinked off
  isFlickerOff: boolean
}

export function phase({ now, lastRequestAt }: Pick<Inputs, 'now' | 'lastRequestAt'>): Phase {
  if (lastRequestAt === null) return { kind: 'unlit' }
  const remaining = TTL_MS - (now - lastRequestAt)
  if (remaining <= 0) return { kind: 'expired', since: -remaining }
  if (remaining < COLD_MS) return { kind: 'cold', remaining, cold: 1 - remaining / COLD_MS }
  return { kind: 'burning', remaining }
}

// A prompt to a cold cache (nothing sent yet, or expired) throws a log on; to a warm one, a poke
export const isColdStart = (now: number, lastRequestAt: number | null) => {
  const k = phase({ now, lastRequestAt }).kind
  return k === 'unlit' || k === 'expired'
}

// How high the fire burns while the cache is warm: 1 fresh, 0.4 as the cold stretch begins
export function intensity(p: Phase): number {
  if (p.kind !== 'burning') return 0
  return 0.4 + 0.6 * ((p.remaining - COLD_MS) / (TTL_MS - COLD_MS))
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
// ms since `at` while it is under `length`, else null
const within = (now: number, at: number | null, length: number) => {
  if (at === null) return null
  const t = now - at
  return t >= 0 && t < length ? t : null
}

export function derive(inp: Inputs): State {
  const p = phase(inp)
  const throwMs = within(inp.now, inp.throwAt, THROW_MS)
  // A throw outranks a poke
  const pokeMs = throwMs === null ? within(inp.now, inp.pokeAt, POKE_MS) : null
  // A fresh log flares up, a poke a little, then the fire settles to what the clock says
  let flare = 0
  const sinceThrow = inp.throwAt === null ? -1 : inp.now - inp.throwAt
  if (sinceThrow >= T_IMPACT) flare = 0.8 * Math.exp(-(sinceThrow - T_IMPACT) / 1600)
  const sincePoke = inp.pokeAt === null ? -1 : inp.now - inp.pokeAt
  for (const jab of P_JABS) if (sincePoke >= jab) flare = Math.max(flare, 0.5 * Math.exp(-(sincePoke - jab) / 700))
  // Before the log lands there is nothing to burn
  const fire = throwMs !== null && throwMs < T_IMPACT ? 0 : clamp(intensity(p) + flare)
  const isStoked = pokeMs !== null && P_JABS.some(j => pokeMs >= j && pokeMs < j + P_JAB_MS)
  const s: State = { kind: p.kind, fire, cold: 0, throwMs, pokeMs, isStoked, fraction: 0, value: '', isFlickerOff: false }
  if (p.kind === 'burning' || p.kind === 'cold') {
    s.fraction = p.remaining / TTL_MS
    s.value = clock(p.remaining)
  }
  if (p.kind === 'cold') {
    s.cold = p.cold
    // Every 30 s a burst of blinks, three off and three on
    const t = inp.now % FLICKER_EVERY_MS
    s.isFlickerOff = p.remaining < LOW_MS && t < FLICKER_MS && Math.floor(t / 250) % 2 === 0
  }
  if (p.kind === 'expired') s.value = 'out'
  return s
}

// --- The bar: one of leitstand's meters ----------------------------------------------------

// leitstand's loud meter (hooks/bars.ts), glyph for glyph: a ▓ body fading ▓▒ at its front
// edge, then a · track. Any time left keeps at least one segment, the last charge
const FULL = '▓'
const RAMP = ['░', '░', '▒', '▓']
const TRACK = '·'
export function loudMeter(fraction: number, width: number): [string, string] {
  const n = fraction <= 0 ? 0 : Math.max(1, Math.min(width, Math.round(fraction * width)))
  const fade = n === width ? [] : [...RAMP].reverse().slice(0, Math.min(2, n))
  return [FULL.repeat(n - fade.length) + fade.join(''), TRACK.repeat(width - n)]
}

export const ROW = { bar: 12, value: 4 }
export const ROW_COLUMNS = ROW.bar + 1 + ROW.value
const TONES: Record<Kind, number> = { unlit: TONE.dim, burning: TONE.clay, cold: TONE.warn, expired: TONE.bad }

// The row as runs of text and color: the bar and the time left
export function row(s: State): [string, number][] {
  // No bar before there is a fire: it shows, full, as the thrown log lands
  if (s.kind === 'unlit' || (s.throwMs !== null && s.throwMs < T_IMPACT)) return []
  const tone = TONES[s.kind]
  let [body, rest] = loudMeter(s.fraction, ROW.bar)
  // The last charge blinks off: the track shows through
  if (s.isFlickerOff && body.length > 0) {
    body = body.slice(0, -1)
    rest = TRACK + rest
  }
  return [
    [body, tone],
    [rest, s.kind === 'expired' ? TONE.bad : TONE.track],
    [` ${s.value.padStart(ROW.value)}`, TONE.dim],
  ]
}

// --- The scene ---------------------------------------------------------------------------

// Where everything sits, in pixels; two pixel rows to a terminal row.
// Clawd and the fireplace both stand on the floor on the last pixel row, 3 pixels apart
export const STAGE = (() => {
  const h = CLAWD.stand.length + 1
  const fireX = artWidth(CLAWD.stand) + 3
  const w = fireX + artWidth(FIREPLACE)
  return { w, h, clawdX: 0, clawdY: 0, fireX, fireY: h - 1 - FIREPLACE.length }
})()
const GAP = 2
export const COLUMNS = ROW_COLUMNS + GAP + STAGE.w
export const ROWS = STAGE.h / 2

export type Drawn = { cells: Uint32Array; columns: number; rows: number }
// A text glyph over the half-blocks, at a column and terminal row of the stage
type Glyph = { x: number; row: number; ch: string; fg: number }

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
  const glyphs: Glyph[] = []

  // The floor, in the side wall's shadow at the far end
  for (let x = 0; x < w; x++) put(x, h - 1, x >= w - SIDE_W ? PAL.Z! : PAL.G!)
  drawFireplace(s, tick, sprite, put)
  drawClawd(s, now, sprite, glyphs)

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
  // A glyph takes the cell; behind it the pixel it covers most, the lower one first
  for (const g of glyphs) {
    if (g.x < 0 || g.x >= w || g.row < 0 || g.row >= ROWS) continue
    const at = (g.row * COLUMNS + ROW_COLUMNS + GAP + g.x) * 3
    const top = px[g.row * 2 * w + g.x]!
    const bottom = px[(g.row * 2 + 1) * w + g.x]!
    const behind = bottom !== NONE ? bottom : top
    cells[at] = g.ch.codePointAt(0)!; cells[at + 1] = g.fg; cells[at + 2] = behind === NONE ? DEFAULT : behind
  }
  return { cells, columns: COLUMNS, rows: ROWS }
}

type Sprite = (art: Art, x: number, y: number, color?: (ch: string) => number | undefined) => void
type Put = (x: number, y: number, c: number) => void
// The fireplace's rows on the stage
const BED_Y = STAGE.fireY + BED.y
const LOGS_Y = STAGE.fireY + LOGS_ROW

// The fireplace tells the state: flames by height, then embers, then ash and smoke
function drawFireplace(s: State, tick: number, sprite: Sprite, put: Put) {
  const fx = STAGE.fireX
  const isLit = s.fire > 0
  // The firebrick and the inner wall take the fire's glow
  const glow = isLit ? 0.25 + 0.45 * s.fire : s.kind === 'cold' ? 0.18 * (1 - s.cold) : 0
  sprite(FIREPLACE, fx, STAGE.fireY, ch => {
    if (ch === 'k') return mix(PAL.k!, 0x8a3a22, glow)
    if (ch === 'D') return mix(PAL.D!, 0x4a1e10, glow * 0.6)
    if (ch === 'w') return mix(PAL.w!, 0x8b3a2a, glow)
    return PAL[ch]
  })

  const x0 = fx + BED.x
  if (isLit) {
    // Two rows as the cooking scene has them, three while the fire is high
    const rows = s.fire >= 0.75 ? 3 : 2
    for (let r = 0; r < rows; r++) {
      const y = BED_Y - r
      // Each row up is narrower; the top row is the cooking scene's tips
      const inset = r === 0 ? 0 : Math.min(3, r + 1)
      for (let i = inset; i < BED.w - inset; i++) {
        let ch: string
        if (r === 0) ch = (i + tick) % 2 === 0 ? 'F' : 'f'
        else if (r === rows - 1) ch = TIPS[(tick + r * 5) % TIPS.length]![i]!
        else ch = hash(tick, r * 16 + i) < 0.7 ? ((i + tick + r) % 2 === 0 ? 'F' : 'y') : '.'
        if (ch !== '.') put(x0 + i, y, PAL[ch]!)
      }
    }
    // Sparks up the flue from a fresh log or a poke
    if (s.fire > 0.9 || s.isStoked) {
      for (let k = 0; k < 3; k++) {
        const y = BED_Y - rows - Math.floor(hash(tick, 300 + k) * 2)
        if (y >= STAGE.fireY + 3 && hash(tick, 100 + k) < 0.6) put(x0 + 1 + Math.floor(hash(tick, 200 + k) * (BED.w - 2)), y, PAL.y!)
      }
    }
    return
  }
  if (s.kind === 'cold') {
    // Embers on the logs, fewer as the cold stretch runs out, and a thread of smoke
    for (let i = 0; i < BED.w; i++) {
      if (hash(i, 7) < 0.75 - 0.6 * s.cold) put(x0 + i, LOGS_Y, PAL[(i + tick) % 3 === 0 ? 'F' : 'f']!)
    }
    smoke(x0 + 3, 0.5, tick, sprite)
    return
  }
  if (s.kind === 'expired') {
    for (let i = 0; i < BED.w; i++) if (i % 5 !== 4) put(x0 + i, LOGS_Y, PAL.a!)
    smoke(x0 + 2, 1, tick, sprite)
  }
}

// A puff rising from the logs into the flue, every 16 ticks
function smoke(x: number, strength: number, tick: number, sprite: Sprite) {
  const t = tick % 16
  if (t >= 8) return
  const y = LOGS_Y - 1 - Math.floor(t / 2)
  if (y < STAGE.fireY + 3) return
  const puff = PUFFS[Math.min(PUFFS.length - 1, Math.floor(t / 3))]!
  const color = mix(PAL.D!, PAL.s!, strength * (1 - t / 12))
  sprite(puff, x + (t >> 2), y - puff.length + 1, ch => (ch === 's' ? color : undefined))
}

function drawClawd(s: State, now: number, sprite: Sprite, glyphs: Glyph[]) {
  const { clawdX: x, clawdY: y } = STAGE
  if (s.throwMs !== null) return drawThrow(Math.floor(s.throwMs / 125) * 125, sprite)
  if (s.pokeMs !== null) return drawPoke(Math.floor(s.pokeMs / 125) * 125, sprite, glyphs)
  const isBlink = now % 4100 < 160
  // Now and then he looks out of the band
  const isFront = now % 17000 > 15200
  const isCold = s.kind === 'cold' || s.kind === 'expired'
  // Cold: rubbing his hands for 2 s in every 6, else holding them together
  const isRubbing = now % 6000 < 2000
  let art: Art
  if (isFront) art = CLAWD.front
  else if (isCold) art = isRubbing && Math.floor(now / 250) % 2 === 1 ? CLAWD.rub : CLAWD.warm
  else if (s.kind === 'burning') art = CLAWD.warm
  else art = CLAWD.stand
  sprite(isBlink ? shut(art) : art, x, y)
  if (isCold) sprite(SCARF, x, y)
}

// Two steps over `from` -> `to`, 125 ms a frame: a step, then standing a pixel on, twice
function walk(t: number, from: number, to: number, face: (a: Art) => Art, sprite: Sprite) {
  const i = Math.min(3, Math.floor(t / 125))
  const x = from + Math.sign(to - from) * [0, 1, 1, 2][i]!
  sprite(face(i % 2 === 0 ? CLAWD.step : CLAWD.stand), x, STAGE.clawdY)
}
const facing = (a: Art) => a

function drawThrow(t: number, sprite: Sprite) {
  const { clawdY: y, fireX } = STAGE
  const x = 2
  if (t < T_WALK) return walk(t, 0, x, facing, sprite)
  if (t < T_PICK) return sprite(CLAWD.crouch, x, y)
  if (t < T_LIFT) {
    sprite(CLAWD.stand, x, y)
    return sprite(LOG, x + 15, y + 3)
  }
  if (t < T_RELEASE) {
    sprite(CLAWD.toss, x, y)
    return sprite(LOG, x + 16, y)
  }
  if (t < T_IMPACT) {
    // The log goes forward and drops into the fire
    const k = (t - T_RELEASE) / (T_IMPACT - T_RELEASE)
    sprite(CLAWD.toss, x, y)
    return sprite(LOG, lerp(x + 16, fireX + BED.x + 2, k), lerp(y + 1, BED_Y - 1, k))
  }
  // He watches it catch, eyes shut, then turns and walks back
  if (t < T_TURN) return sprite(shut(CLAWD.stand), x, y)
  if (t < T_BACK) return sprite(turned(CLAWD.stand), x, y)
  if (t < T_BACK + 500) return walk(t - T_BACK, x, 0, turned, sprite)
  if (t < T_BACK + 625) return sprite(turned(CLAWD.stand), 0, y)
  sprite(CLAWD.stand, 0, y)
}

function drawPoke(t: number, sprite: Sprite, glyphs: Glyph[]) {
  const { clawdY: y, fireX } = STAGE
  const x = 1
  if (t < P_REACH) return walk(t, 0, x, facing, sprite)
  if (t >= P_DONE) {
    const back = t - P_DONE < 125
    return sprite(back ? CLAWD.step : CLAWD.stand, back ? x : 0, y)
  }
  sprite(CLAWD.poke, x, y)
  // The poker, a wooden stick thinner than his arm: a straight ─ from his hand into the opening;
  // a jab pushes it a column in and lights its tip
  const isIn = P_JABS.some(j => t >= j && t < j + P_JAB_MS)
  const tipX = fireX + BED.x + 2 + (isIn ? 1 : 0)
  const row = (y + 4) / 2
  for (let gx = x + artWidth(CLAWD.poke); gx < tipX; gx++) glyphs.push({ x: gx, row, ch: '─', fg: PAL.L! })
  glyphs.push({ x: tipX, row, ch: '─', fg: isIn ? PAL.F! : PAL.L! })
}

// One row for a narrow terminal: the bar alone
export function line(s: State): Drawn {
  const cells = new Uint32Array(ROW_COLUMNS * 3)
  for (let i = 0; i < ROW_COLUMNS; i++) { cells[i * 3] = 0x20; cells[i * 3 + 1] = DEFAULT; cells[i * 3 + 2] = DEFAULT }
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
