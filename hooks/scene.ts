// The furnace scene, drawn into Raster cells. Pure: no `$`, so tools/preview can run it too.
import {
  CLAWD, CLAWD_BLINK, CLAWD_CROUCH, CLAWD_LEFT, CLAWD_RIGHT, CLAWD_UP,
  FURNACE, LOG, MOUTH, PAL, PIPE_TOP,
} from './sprites'

// Text on the left, the stage on the right
export const LABEL_W = 13
export const STAGE_W = 40
export const STAGE_H = 16
export const COLS = LABEL_W + STAGE_W
export const ROWS = STAGE_H / 2

export const COLD_MS = 10 * 60 * 1000

// The throw, in ms after the prompt was sent
const T_CROUCH = 300
const T_LIFT = 750
const T_IMPACT = 1150
const T_DONE = 1900

const HOME_X = 8
const THROW_X = 10
const CLAWD_Y = 8
const FURNACE_X = 24
const FURNACE_Y = STAGE_H - FURNACE.length

const DEFAULT = 0x01000000
const NONE = -1
const DIM = 0x8a8580
const ICE = 0xbfe6ff
const SNOW = [0xeef7ff, 0xb9dcf5]
// Heat 0..1 to color, coldest first
const FLAME = [0x5a1208, 0x9c1f0a, 0xd4400f, 0xf07818, 0xf9b233, 0xffe680]

export type Inputs = {
  now: number
  // When the main loop last sent a request: the cache was written or read then
  lastRequestAt: number | null
  ttlMs: number
  // When the person last sent a prompt: Clawd throws a log
  throwAt: number | null
}

export type Phase =
  | { kind: 'unlit' }
  | { kind: 'burning'; remaining: number }
  | { kind: 'cold'; remaining: number; cold: number }
  | { kind: 'out'; since: number }

// The last 10 minutes are cold; with a short cache (5 minutes on the API) the last third
const coldMs = (ttlMs: number) => Math.min(COLD_MS, ttlMs / 3)

export function phase({ now, lastRequestAt, ttlMs }: Inputs): Phase {
  if (lastRequestAt === null) return { kind: 'unlit' }
  const remaining = ttlMs - (now - lastRequestAt)
  if (remaining <= 0) return { kind: 'out', since: -remaining }
  if (remaining < coldMs(ttlMs)) return { kind: 'cold', remaining, cold: 1 - remaining / coldMs(ttlMs) }
  return { kind: 'burning', remaining }
}

// How high the fire burns, 0..1, before the flare of a fresh log
export function intensity(p: Phase, ttlMs: number): number {
  const cold = coldMs(ttlMs)
  if (p.kind === 'burning') return 0.4 + 0.6 * ((p.remaining - cold) / Math.max(1, ttlMs - cold))
  if (p.kind === 'cold') return 0.1 + 0.22 * (1 - p.cold)
  return 0
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

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Particle = { x: number; y: number; life: number; max: number; dx: number; kind: 'spark' | 'smoke' | 'snow' }

export function createScene(seed = 7) {
  const rnd = rng(seed)
  const heat = new Float32Array(MOUTH.w * MOUTH.h)
  let parts: Particle[] = []
  let burstFor: number | null = null
  let frameNo = 0

  const px = new Int32Array(STAGE_W * STAGE_H)
  const glyph = new Int32Array(COLS * ROWS)
  const glyphFg = new Int32Array(COLS * ROWS)

  const put = (x: number, y: number, c: number) => {
    x = Math.round(x); y = Math.round(y)
    if (x >= 0 && y >= 0 && x < STAGE_W && y < STAGE_H) px[y * STAGE_W + x] = c
  }
  const sprite = (art: string[], x: number, y: number, tint?: (c: number) => number) => {
    art.forEach((line, j) => {
      for (let i = 0; i < line.length; i++) {
        const c = PAL[line[i]!]
        if (c !== undefined) put(x + i, y + j, tint ? tint(c) : c)
      }
    })
  }
  const text = (row: number, s: string, fg: number) => {
    ;[...s].slice(0, LABEL_W).forEach((ch, i) => {
      glyph[row * COLS + i] = ch.codePointAt(0)!
      glyphFg[row * COLS + i] = fg
    })
  }

  function stepFire(level: number) {
    const { w, h } = MOUTH
    const decay = lerp(0.6, 0.24, level)
    for (let y = 0; y < h - 1; y++) {
      for (let x = 0; x < w; x++) {
        const sx = clamp(x + Math.round(rnd() * 2 - 1), 0, w - 1)
        heat[y * w + x] = Math.max(0, heat[(y + 1) * w + sx]! - rnd() * decay)
      }
    }
    for (let x = 0; x < w; x++) {
      // Lower at the sides, so the flames come to a point
      const edge = 1 - 0.45 * Math.abs((x - (w - 1) / 2) / ((w - 1) / 2)) ** 2
      const ember = level < 0.25 ? (rnd() < 0.5 ? 1 : 0.35) : 1
      heat[(h - 1) * w + x] = level <= 0 ? 0 : level * edge * ember * (0.75 + 0.25 * rnd())
    }
  }

  function drawFire(level: number) {
    const ox = FURNACE_X + MOUTH.x
    const oy = FURNACE_Y + MOUTH.y
    // Two logs on the grate, glowing as hot as the fire
    const glow = mix(PAL.w!, 0xd4400f, clamp(level * 1.4))
    for (let x = 1; x < MOUTH.w - 1; x++) put(ox + x, oy + MOUTH.h - 1, x === 4 ? PAL.o! : x % 3 === 0 ? glow : PAL.w!)
    if (level <= 0) {
      // Ash
      for (let x = 2; x < MOUTH.w - 2; x += 2) put(ox + x, oy + MOUTH.h - 2, 0x4a4542)
      return
    }
    for (let y = 0; y < MOUTH.h; y++) {
      for (let x = 0; x < MOUTH.w; x++) {
        const v = heat[y * MOUTH.w + x]!
        if (v < 0.14 || FURNACE[MOUTH.y + y]![MOUTH.x + x] !== 'D') continue
        put(ox + x, oy + y, FLAME[Math.min(FLAME.length - 1, Math.floor(((v - 0.14) / 0.8) * FLAME.length))]!)
      }
    }
  }

  function spawn(level: number, cold: number, isOut: boolean) {
    const pipeX = FURNACE_X + PIPE_TOP.x + Math.floor(rnd() * PIPE_TOP.w)
    if (level > 0.5 && rnd() < (level - 0.45) * 0.9) {
      parts.push({ x: pipeX, y: FURNACE_Y - 1, life: 0, max: 2 + Math.floor(rnd() * 3), dx: 0, kind: 'spark' })
    }
    if ((cold > 0 || isOut) && frameNo % 3 === 0 && rnd() < (isOut ? 0.35 : 0.6)) {
      parts.push({ x: pipeX, y: FURNACE_Y - 1, life: 0, max: 5, dx: 0, kind: 'smoke' })
    }
    const snow = isOut ? 0.7 : cold * 0.6
    if (snow > 0 && rnd() < snow) {
      parts.push({ x: Math.floor(rnd() * STAGE_W), y: 0, life: 0, max: STAGE_H + 2, dx: 0, kind: 'snow' })
    }
  }

  function burst() {
    const mx = FURNACE_X + MOUTH.x
    for (let i = 0; i < 7; i++) {
      parts.push({ x: mx + 1 + Math.floor(rnd() * (MOUTH.w - 2)), y: FURNACE_Y + MOUTH.y - 1, life: 0, max: 3 + Math.floor(rnd() * 3), dx: rnd() < 0.5 ? -1 : 1, kind: 'spark' })
    }
    for (let i = 0; i < 3; i++) {
      parts.push({ x: FURNACE_X + PIPE_TOP.x + i, y: FURNACE_Y - 1 - i, life: 0, max: 3 + i, dx: 0, kind: 'spark' })
    }
  }

  function moveParticles() {
    parts = parts.filter(p => {
      p.life += 1
      if (p.kind === 'spark') {
        p.y -= 1
        if (p.dx && p.life % 2 === 0) p.x += p.dx
        else if (rnd() < 0.3) p.x += rnd() < 0.5 ? -1 : 1
      } else if (p.kind === 'smoke') {
        if (p.life % 2 === 0) { p.y -= 1; p.x += rnd() < 0.6 ? 1 : 0 }
      } else {
        p.y += 1
        if (rnd() < 0.25) p.x += rnd() < 0.5 ? -1 : 1
      }
      return p.life <= p.max && p.y >= 0 && p.y < STAGE_H
    })
  }

  function drawParticles() {
    const mouthX0 = FURNACE_X + MOUTH.x
    const mouthY0 = FURNACE_Y + MOUTH.y
    for (const p of parts) {
      if (p.kind === 'spark') put(p.x, p.y, FLAME[clamp(5 - Math.floor((p.life / p.max) * 3), 2, 5)]!)
      else if (p.kind === 'smoke') put(p.x, p.y, mix(0x8a8580, 0x4a4542, p.life / p.max))
      else {
        const inMouth = p.x >= mouthX0 && p.x < mouthX0 + MOUTH.w && p.y >= mouthY0 && p.y < mouthY0 + MOUTH.h
        if (!inMouth) put(p.x, p.y, SNOW[p.life % 2]!)
      }
    }
  }

  function bar(frac: number, color: number) {
    // Leitstand's loud meter: a solid body dissolving at its edge, then a dotted track
    const width = 12
    const n = Math.round(clamp(frac) * width)
    const shimmer = frameNo % 4 < 2
    const fade = n === width ? [] : (shimmer ? ['▒', '░'] : ['▓', '▒']).slice(0, Math.min(2, n))
    const body = '▓'.repeat(n - fade.length) + fade.join('')
    text(ROWS - 1, body, color)
    ;[...'·'.repeat(width - n)].forEach((ch, i) => {
      glyph[(ROWS - 1) * COLS + n + i] = ch.codePointAt(0)!
      glyphFg[(ROWS - 1) * COLS + n + i] = DIM
    })
  }

  function label(p: Phase, ttlMs: number, level: number) {
    text(ROWS - 3, 'prompt cache', DIM)
    if (p.kind === 'unlit') {
      text(ROWS - 2, 'unlit', DIM)
      bar(0, DIM)
    } else if (p.kind === 'out') {
      text(ROWS - 2, `expired ${clock(p.since)}`.slice(0, LABEL_W), ICE)
      bar(0, ICE)
    } else {
      const color = p.kind === 'cold' ? mix(0xf07818, ICE, 0.4 + 0.6 * p.cold) : FLAME[clamp(Math.floor(level * 6), 3, 5)]!
      text(ROWS - 2, `${clock(p.remaining)} left`, color)
      bar(p.remaining / ttlMs, color)
    }
  }

  function frame(inp: Inputs): Uint32Array {
    frameNo += 1
    px.fill(NONE)
    glyph.fill(0)

    const p = phase(inp)
    const since = inp.throwAt === null ? Infinity : inp.now - inp.throwAt
    const isThrowing = since >= 0 && since < T_DONE
    if (since >= T_IMPACT && since < T_DONE + 500 && burstFor !== inp.throwAt) {
      burstFor = inp.throwAt
      burst()
    }
    // A fresh log flares up, then settles to what the clock says
    const flare = since >= T_IMPACT ? 0.75 * Math.exp(-(since - T_IMPACT) / 1400) : 0
    const level = clamp(intensity(p, inp.ttlMs) + flare)
    const cold = p.kind === 'cold' ? p.cold : 0
    const isOut = p.kind === 'out'

    stepFire(level)
    spawn(level, cold, isOut && !isThrowing)
    moveParticles()

    // Woodpile
    sprite(LOG, 0, STAGE_H - 2)
    sprite(LOG, 1, STAGE_H - 4)
    sprite(LOG, 0, STAGE_H - 6)

    sprite(FURNACE, FURNACE_X, FURNACE_Y, c => (cold > 0 || isOut) && c === PAL.h ? mix(c, ICE, isOut ? 0.8 : cold * 0.7) : c)
    drawFire(level)

    // Clawd
    const chill = isThrowing ? 0 : isOut ? 0.55 : cold * 0.5
    const tint = (c: number) => (chill > 0 && c === PAL.X ? mix(c, ICE, chill) : c)
    if (isThrowing) {
      if (since < T_CROUCH) {
        sprite(CLAWD_CROUCH, HOME_X, CLAWD_Y + 1, tint)
        sprite(LOG, HOME_X - 2, STAGE_H - 3)
      } else if (since < T_LIFT) {
        const t = (since - T_CROUCH) / (T_LIFT - T_CROUCH)
        const x = Math.round(lerp(HOME_X, THROW_X, t))
        const hop = t > 0.25 && t < 0.75 ? 1 : 0
        sprite(CLAWD_UP, x, CLAWD_Y - hop, tint)
        sprite(LOG, x + 3, CLAWD_Y - hop - 2)
      } else if (since < T_IMPACT) {
        const t = (since - T_LIFT) / (T_IMPACT - T_LIFT)
        sprite(CLAWD_RIGHT, THROW_X, CLAWD_Y, tint)
        const fromX = THROW_X + 3
        const fromY = CLAWD_Y - 2
        const toX = FURNACE_X + MOUTH.x + 2
        const toY = FURNACE_Y + MOUTH.y + MOUTH.h - 3
        sprite(LOG, lerp(fromX, toX, t), lerp(fromY, toY, t) - 5 * Math.sin(Math.PI * t))
      } else {
        // Happy hop back home, eyes shut
        const t = (since - T_IMPACT) / (T_DONE - T_IMPACT)
        const x = Math.round(lerp(THROW_X, HOME_X, t))
        const hop = (t > 0.1 && t < 0.35) || (t > 0.6 && t < 0.85) ? 1 : 0
        sprite(hop ? CLAWD_BLINK : CLAWD_RIGHT, x, CLAWD_Y - hop, tint)
      }
    } else if (isOut) {
      // Frozen in a block of ice
      for (let y = CLAWD_Y - 1; y < STAGE_H; y++) {
        for (let x = HOME_X - 1; x <= HOME_X + 12; x++) {
          const isEdge = y === CLAWD_Y - 1 || x === HOME_X - 1 || x === HOME_X + 12
          put(x, y, isEdge ? 0xd6f1ff : 0x6f9fc0)
        }
      }
      sprite(CLAWD_BLINK, HOME_X, CLAWD_Y, c => (c === PAL.X ? mix(c, ICE, 0.55) : c))
      put(HOME_X + 1, CLAWD_Y, 0xffffff)
    } else {
      // Shivers when the fire runs low; blinks now and then
      const shiver = cold > 0 && frameNo % 2 === 0 ? (frameNo % 4 === 0 ? 1 : -1) : 0
      const isBlink = inp.now % 4100 < 160
      const art = isBlink ? CLAWD_BLINK : p.kind === 'unlit' ? CLAWD : CLAWD_RIGHT
      sprite(art, HOME_X + shiver, CLAWD_Y, tint)
      // Breath in the cold
      if (cold > 0.2 && inp.now % 1800 < 450) {
        put(HOME_X + 12 + shiver, CLAWD_Y + 1, 0xeef7ff)
        put(HOME_X + 13 + shiver, CLAWD_Y, 0xb9dcf5)
      }
    }

    drawParticles()
    label(p, inp.ttlMs, level)
    return compose()
  }

  // Two stage pixels per cell, the label's glyphs over them
  function compose(): Uint32Array {
    const cells = new Uint32Array(COLS * ROWS * 3)
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const at = (row * COLS + col) * 3
        const g = glyph[row * COLS + col]!
        if (g) {
          cells[at] = g; cells[at + 1] = glyphFg[row * COLS + col]!; cells[at + 2] = DEFAULT
          continue
        }
        const sx = col - LABEL_W
        const top = sx >= 0 ? px[row * 2 * STAGE_W + sx]! : NONE
        const bottom = sx >= 0 ? px[(row * 2 + 1) * STAGE_W + sx]! : NONE
        if (top === NONE && bottom === NONE) { cells[at] = 0x20; cells[at + 1] = DEFAULT; cells[at + 2] = DEFAULT }
        else if (bottom === NONE) { cells[at] = 0x2580; cells[at + 1] = top; cells[at + 2] = DEFAULT }
        else if (top === NONE) { cells[at] = 0x2584; cells[at + 1] = bottom; cells[at + 2] = DEFAULT }
        else { cells[at] = 0x2580; cells[at + 1] = top; cells[at + 2] = bottom }
      }
    }
    return cells
  }

  // One row for a narrow terminal: the label and the bar, no stage
  function compact(inp: Inputs): Uint32Array {
    frameNo += 1
    const p = phase(inp)
    const since = inp.throwAt === null ? Infinity : inp.now - inp.throwAt
    const flare = since >= T_IMPACT ? 0.75 * Math.exp(-(since - T_IMPACT) / 1400) : 0
    glyph.fill(0)
    label(p, inp.ttlMs, clamp(intensity(p, inp.ttlMs) + flare))
    const line: [number, number][] = []
    const row = (r: number) => {
      const out: [number, number][] = []
      for (let c = 0; c < LABEL_W; c++) out.push([glyph[r * COLS + c]! || 0x20, glyph[r * COLS + c] ? glyphFg[r * COLS + c]! : DEFAULT])
      return out
    }
    const words = row(ROWS - 2)
    // Drop the padding after the words, keep one space
    while (words.length && words[words.length - 1]![0] === 0x20) words.pop()
    line.push(...row(ROWS - 3).slice(0, 7), ...words, [0x20, DEFAULT])
    line.push(...row(ROWS - 1).slice(0, 12))
    const cells = new Uint32Array(COMPACT_COLS * 3)
    for (let c = 0; c < COMPACT_COLS; c++) {
      const [cp, fg] = line[c] ?? [0x20, DEFAULT]
      cells[c * 3] = cp; cells[c * 3 + 1] = fg; cells[c * 3 + 2] = DEFAULT
    }
    return cells
  }

  return { frame, compact }
}

// "prompt " + "expired 59:59" + " " + a 12-cell bar
export const COMPACT_COLS = 7 + 13 + 1 + 12

export function toBase64(cells: Uint32Array): string {
  // Little-endian words, as RasterProps asks. The environment has toBase64; lib es2023 does not type it
  const bytes = new Uint8Array(cells.buffer, cells.byteOffset, cells.byteLength) as Uint8Array & { toBase64(): string }
  return bytes.toBase64()
}
