// The furnace scene, drawn into Raster cells. Pure: no `$`, so the tuner and tools/preview run it too.
// Two steps: derive() turns the clock into a State per object, a scene draws a State in a Look.
import { CLAWDS, FURNACES, PAL, SCARF, THROWN, artWidth } from './sprites'
import type { Art, ClawdArt, FurnaceArt, ThrownArt } from './sprites'

export const COLD_MS = 10 * 60 * 1000

// The throw, in ms after the prompt was sent
const T_CROUCH = 300
const T_LIFT = 750
const T_IMPACT = 1150
export const THROW_MS = 1900

const DEFAULT = 0x01000000
const NONE = -1
const ICE = 0xbfe6ff
const SNOW = [0xeef7ff, 0xb9dcf5]
const ASH = 0x4a4542
// Heat 0..1 to color, coldest first
const FLAME = [0x5a1208, 0x9c1f0a, 0xd4400f, 0xf07818, 0xf9b233, 0xffe680]
// leitstand's colors
export const TONE = { clay: 0xd97757, warn: 0xd08a1e, bad: 0xd9534f, track: 0x8a8580 }

// What the tuner exports and hooks/look.ts holds
export type Look = {
  // Of the first version's 53 x 8: 75 is 6 rows, 60 is 5
  size: 75 | 60
  clawd: string
  furnace: string
  thrown: string
  burning: 'steady' | 'plume' | 'warm'
  cold: 'shiver' | 'scarf' | 'huddle'
  expired: 'ice' | 'asleep' | 'smoke'
  bar: {
    style: 'loud' | 'quiet'
    width: number
    // stack: title and time over the bar; line: time after the bar
    layout: 'stack' | 'line'
    title: 'cache' | 'state' | 'none'
    color: 'leitstand' | 'fire'
  }
}

export const CHOICES = {
  size: [75, 60],
  burning: ['steady', 'plume', 'warm'],
  cold: ['shiver', 'scarf', 'huddle'],
  expired: ['ice', 'asleep', 'smoke'],
  style: ['loud', 'quiet'],
  layout: ['stack', 'line'],
  title: ['cache', 'state', 'none'],
  color: ['leitstand', 'fire'],
} as const

export type Inputs = {
  now: number
  // When the main loop last sent a request: the cache was written or read then
  lastRequestAt: number | null
  ttlMs: number
  // When the person last sent a prompt: Clawd throws
  throwAt: number | null
}

export type Phase =
  | { kind: 'unlit' }
  | { kind: 'burning'; remaining: number }
  | { kind: 'cold'; remaining: number; cold: number }
  | { kind: 'expired'; since: number }

export type Pose = 'front' | 'watch' | 'warm' | 'shiver' | 'scarf' | 'huddle' | 'ice' | 'asleep' | 'pale'
export const POSES: Pose[] = ['front', 'watch', 'warm', 'shiver', 'scarf', 'huddle', 'ice', 'asleep', 'pale']

// Each object's state; the tuner sets any of them by hand
export type State = {
  kind: Phase['kind']
  // Furnace, 0..1
  fire: number
  sparks: number
  smoke: number
  // ms into the throw, null when Clawd is not throwing
  throwMs: number | null
  // Clawd
  pose: Pose
  chill: number
  // Weather, 0..1
  snow: number
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

export function derive(inp: Inputs, look: Look): State {
  const p = phase(inp)
  const since = inp.throwAt === null ? Infinity : inp.now - inp.throwAt
  const throwMs = since >= 0 && since < THROW_MS ? since : null
  // A fresh log flares up, then settles to what the clock says
  const flare = since >= T_IMPACT ? 0.75 * Math.exp(-(since - T_IMPACT) / 1400) : 0
  const fire = clamp(intensity(p, inp.ttlMs) + flare)
  const sparks = fire > 0.5 ? (fire - 0.45) * (look.burning === 'steady' ? 0.6 : 0.9) : 0
  const s: State = { kind: p.kind, fire, sparks, smoke: 0, throwMs, pose: 'front', chill: 0, snow: 0, fraction: 0, value: '' }
  if (p.kind === 'burning') {
    s.pose = look.burning === 'warm' ? 'warm' : 'watch'
    s.smoke = look.burning === 'plume' ? 0.25 + 0.4 * fire : 0
    s.fraction = p.remaining / inp.ttlMs
    s.value = clock(p.remaining)
  } else if (p.kind === 'cold') {
    s.pose = look.cold
    s.smoke = 0.6
    s.snow = p.cold * 0.6
    s.chill = p.cold * (look.cold === 'scarf' ? 0.3 : 0.5)
    s.fraction = p.remaining / inp.ttlMs
    s.value = clock(p.remaining)
  } else if (p.kind === 'expired') {
    s.pose = look.expired === 'smoke' ? 'pale' : look.expired
    s.smoke = look.expired === 'smoke' ? 0.6 : 0.25
    s.snow = look.expired === 'ice' ? 0.7 : look.expired === 'asleep' ? 0.5 : 0
    s.chill = look.expired === 'ice' ? 0.55 : 0.4
    s.value = look.bar.title === 'state' ? clock(p.since) : 'out'
  }
  if (throwMs !== null) s.chill = 0
  return s
}

const STATE_WORD: Record<State['kind'], string> = { unlit: 'unlit', burning: 'burning', cold: 'cooling', expired: 'expired' }

// leitstand's bars (hooks/bars.ts), as they are
const DOT = '·'
const RAMP = ['░', '░', '▒', '▓']
const fill = (pct: number, width: number) => Math.max(0, Math.min(width, Math.round((pct / 100) * width)))
// quiet: thin lines
export function meter(pct: number, width: number): [string, string] {
  const n = fill(pct, width)
  return ['━'.repeat(n), '─'.repeat(width - n)]
}
// loud: a solid body that dissolves at its edge, then a dotted track
export function loudMeter(pct: number, width: number): [string, string] {
  const n = fill(pct, width)
  const fade = n === width ? [] : [...RAMP].reverse().slice(0, Math.min(2, n))
  return ['▓'.repeat(n - fade.length) + fade.join(''), DOT.repeat(width - n)]
}

function pick<T>(table: Record<string, T>, name: string): T {
  return table[name] ?? Object.values(table)[0]!
}

// Where everything sits for a Look
export function geometry(look: Look) {
  const clawd = pick(CLAWDS, look.clawd)
  const furnace = pick(FURNACES, look.furnace)
  const thrown = pick(THROWN, look.thrown)
  const stageH = look.size === 75 ? 12 : 10
  const homeX = artWidth(thrown.pile) + 1
  // Room for the warming arms, a pixel short of the iron
  const furnaceX = homeX + 14
  const stageW = furnaceX + artWidth(furnace.art)
  const labelW = look.bar.layout === 'stack' ? look.bar.width : look.bar.width + 5
  const gap = 1
  return {
    clawd, furnace, thrown, stageH, stageW, homeX, furnaceX, labelW, gap,
    throwX: homeX + 1,
    clawdY: stageH - 8,
    furnaceY: stageH - furnace.art.length,
    columns: labelW + gap + stageW,
    rows: stageH / 2,
  }
}
export type Geometry = ReturnType<typeof geometry>

// The one row drawn where the scene does not fit
export function lineColumns(look: Look) {
  return (look.bar.title === 'none' ? 0 : 8) + look.bar.width + 5
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
export type Drawn = { cells: Uint32Array; columns: number; rows: number }

export function createScene(seed = 7) {
  const rnd = rng(seed)
  let heat = new Float32Array(0)
  let parts: Particle[] = []
  let burstDone = false
  let frameNo = 0

  // Sized for the last geometry drawn
  let g: Geometry
  let px = new Int32Array(0)
  let glyph = new Int32Array(0)
  let glyphFg = new Int32Array(0)

  const put = (x: number, y: number, c: number) => {
    x = Math.round(x); y = Math.round(y)
    if (x >= 0 && y >= 0 && x < g.stageW && y < g.stageH) px[y * g.stageW + x] = c
  }
  const sprite = (art: Art, x: number, y: number, tint?: (c: number) => number) => {
    art.forEach((line, j) => {
      for (let i = 0; i < line.length; i++) {
        const c = PAL[line[i]!]
        if (c !== undefined) put(x + i, y + j, tint ? tint(c) : c)
      }
    })
  }
  const text = (col: number, row: number, s: string, fg: number) => {
    ;[...s].forEach((ch, i) => {
      if (col + i < 0 || col + i >= g.columns) return
      glyph[row * g.columns + col + i] = ch.codePointAt(0)!
      glyphFg[row * g.columns + col + i] = fg
    })
  }

  function resize(look: Look) {
    const next = geometry(look)
    const isNew = !g || next.stageW !== g.stageW || next.stageH !== g.stageH || next.columns !== g.columns || next.furnace !== g.furnace
    if (!g || next.furnace !== g.furnace) heat = new Float32Array(next.furnace.mouth.w * next.furnace.mouth.h)
    if (isNew) {
      px = new Int32Array(next.stageW * next.stageH)
      glyph = new Int32Array(next.columns * next.rows)
      glyphFg = new Int32Array(next.columns * next.rows)
      parts = []
    }
    g = next
  }

  function stepFire(level: number) {
    const { w, h } = g.furnace.mouth
    const decay = lerp(0.7, 0.2, level)
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
      // A burning fire fills the firebox; embers stay low
      const fuel = level + 0.3 * clamp((level - 0.3) / 0.4)
      heat[(h - 1) * w + x] = level <= 0 ? 0 : clamp(fuel) * edge * ember * (0.75 + 0.25 * rnd())
    }
  }

  function drawFire(level: number) {
    const { mouth, art } = g.furnace
    const ox = g.furnaceX + mouth.x
    const oy = g.furnaceY + mouth.y
    const isInside = (x: number, y: number) => art[mouth.y + y]?.[mouth.x + x] === 'D'
    // A log on the grate, glowing as hot as the fire
    const glow = mix(PAL.w!, 0xd4400f, clamp(level * 1.4))
    for (let x = 1; x < mouth.w - 1; x++) {
      if (isInside(x, mouth.h - 1)) put(ox + x, oy + mouth.h - 1, x === 2 ? PAL.o! : x % 2 === 0 ? glow : PAL.w!)
    }
    if (level <= 0) {
      for (let x = 1; x < mouth.w - 1; x += 2) if (isInside(x, mouth.h - 2)) put(ox + x, oy + mouth.h - 2, ASH)
      return
    }
    for (let y = 0; y < mouth.h; y++) {
      for (let x = 0; x < mouth.w; x++) {
        const v = heat[y * mouth.w + x]!
        if (v < 0.14 || !isInside(x, y)) continue
        put(ox + x, oy + y, FLAME[Math.min(FLAME.length - 1, Math.floor(((v - 0.14) / 0.8) * FLAME.length))]!)
      }
    }
  }

  function spawn(s: State) {
    const { pipe } = g.furnace
    const pipeX = g.furnaceX + pipe.x + Math.floor(rnd() * pipe.w)
    const pipeY = g.furnaceY - 1
    if (rnd() < s.sparks) parts.push({ x: pipeX, y: pipeY, life: 0, max: 1 + Math.floor(rnd() * 3), dx: 0, kind: 'spark' })
    if (frameNo % 2 === 0 && rnd() < s.smoke * 0.6) parts.push({ x: pipeX, y: pipeY, life: 0, max: 5, dx: 0, kind: 'smoke' })
    if (rnd() < s.snow) parts.push({ x: Math.floor(rnd() * g.stageW), y: 0, life: 0, max: g.stageH + 2, dx: 0, kind: 'snow' })
  }

  function burst() {
    const { mouth, pipe } = g.furnace
    for (let i = 0; i < 5; i++) {
      parts.push({ x: g.furnaceX + mouth.x + 1 + Math.floor(rnd() * (mouth.w - 2)), y: g.furnaceY + mouth.y - 1, life: 0, max: 2 + Math.floor(rnd() * 2), dx: rnd() < 0.5 ? -1 : 1, kind: 'spark' })
    }
    for (let i = 0; i < 2; i++) parts.push({ x: g.furnaceX + pipe.x + i, y: g.furnaceY - 1 - i, life: 0, max: 2 + i, dx: 0, kind: 'spark' })
  }

  function moveParticles() {
    parts = parts.filter(p => {
      p.life += 1
      if (p.kind === 'spark') {
        p.y -= 1
        if (p.dx && p.life % 2 === 0) p.x += p.dx
        else if (rnd() < 0.3) p.x += rnd() < 0.5 ? -1 : 1
      } else if (p.kind === 'smoke') {
        if (p.life % 2 === 0) { p.y -= 1; p.x += 1 }
      } else {
        p.y += 1
        if (rnd() < 0.25) p.x += rnd() < 0.5 ? -1 : 1
      }
      return p.life <= p.max && p.y >= 0 && p.y < g.stageH
    })
  }

  // Snow falls behind Clawd and outside the firebox; sparks and smoke rise in front
  function drawParticles(isSnow: boolean) {
    const { mouth } = g.furnace
    const mx = g.furnaceX + mouth.x
    const my = g.furnaceY + mouth.y
    for (const p of parts) {
      if ((p.kind === 'snow') !== isSnow) continue
      if (p.kind === 'spark') put(p.x, p.y, FLAME[clamp(5 - Math.floor((p.life / p.max) * 3), 2, 5)]!)
      else if (p.kind === 'smoke') put(p.x, p.y, mix(0x8a8580, 0x4a4542, p.life / p.max))
      else if (!(p.x >= mx && p.x < mx + mouth.w && p.y >= my && p.y < my + mouth.h)) put(p.x, p.y, SNOW[p.life % 2]!)
    }
  }

  function drawThrow(t: number, art: ClawdArt, thrown: ThrownArt) {
    const { homeX, throwX, clawdY, furnaceX, furnaceY } = g
    const { mouth } = g.furnace
    const held = thrown.held
    const hw = artWidth(held)
    if (t < T_CROUCH) {
      // Reaches for the pile
      sprite(art.crouch, homeX, clawdY + 1)
      sprite(held, homeX - hw + 1, g.stageH - 3)
    } else if (t < T_LIFT) {
      const k = (t - T_CROUCH) / (T_LIFT - T_CROUCH)
      const x = Math.round(lerp(homeX, throwX, k))
      const hop = k > 0.25 && k < 0.75 ? 1 : 0
      sprite(art.up, x, clawdY - hop)
      sprite(held, x + 6 - Math.ceil(hw / 2), clawdY - hop - held.length)
    } else if (t < T_IMPACT) {
      const k = (t - T_LIFT) / (T_IMPACT - T_LIFT)
      sprite(art.right, throwX, clawdY)
      const fromX = throwX + 6 - Math.ceil(hw / 2)
      const fromY = clawdY - held.length
      const toX = furnaceX + mouth.x + Math.floor((mouth.w - hw) / 2)
      const toY = furnaceY + mouth.y + mouth.h - held.length - 1
      sprite(held, lerp(fromX, toX, k), lerp(fromY, toY, k) - 3 * Math.sin(Math.PI * k))
    } else {
      // Happy hop back home, eyes shut
      const k = (t - T_IMPACT) / (THROW_MS - T_IMPACT)
      const x = Math.round(lerp(throwX, homeX, k))
      const hop = (k > 0.1 && k < 0.35) || (k > 0.6 && k < 0.85) ? 1 : 0
      sprite(hop ? art.blink : art.right, x, clawdY - hop)
    }
  }

  function drawClawd(s: State, now: number) {
    const art = g.clawd
    const { homeX, clawdY, stageH } = g
    if (s.throwMs !== null) return drawThrow(s.throwMs, art, g.thrown)
    const tint = (c: number) => (s.chill > 0 && c === PAL.X ? mix(c, ICE, s.chill) : c)
    const isBlink = now % 4100 < 160
    const shiver = (every: number) => (frameNo % every === 0 ? (frameNo % (every * 2) === 0 ? 1 : -1) : 0)
    // Puffs of breath in front of the face
    const breath = (x: number) => {
      if (s.chill > 0.1 && now % 1800 < 450) {
        put(x + 12, clawdY + 1, SNOW[0]!)
        put(x + 13, clawdY, SNOW[1]!)
      }
    }
    switch (s.pose) {
      case 'front':
        return sprite(isBlink ? art.blink : art.front, homeX, clawdY, tint)
      case 'watch':
      case 'pale':
        return sprite(isBlink ? art.blink : art.right, homeX, clawdY, tint)
      case 'warm': {
        // The side facing the fire takes its glow
        const glow = 0.15 + 0.35 * s.fire
        sprite(isBlink ? art.blink : art.warm, homeX, clawdY, c => (c === PAL.X ? mix(c, 0xf9b233, glow * 0.5) : c))
        return
      }
      case 'shiver': {
        const dx = shiver(2)
        sprite(isBlink ? art.blink : art.right, homeX + dx, clawdY, tint)
        return breath(homeX + dx)
      }
      case 'scarf': {
        const dx = shiver(4)
        sprite(isBlink ? art.blink : art.right, homeX + dx, clawdY, tint)
        sprite(SCARF, homeX + dx, clawdY)
        return breath(homeX + dx)
      }
      case 'huddle': {
        // Up against the furnace, arms folded
        const x = g.furnaceX - 12 + shiver(2)
        sprite(art.hug, x, clawdY, tint)
        return breath(x)
      }
      case 'ice': {
        for (let y = clawdY - 1; y < stageH; y++) {
          for (let x = homeX - 1; x <= homeX + 12; x++) {
            const isEdge = y === clawdY - 1 || x === homeX - 1 || x === homeX + 12
            put(x, y, isEdge ? 0xd6f1ff : 0x6f9fc0)
          }
        }
        sprite(art.blink, homeX, clawdY, c => (c === PAL.X ? mix(c, ICE, 0.55) : c))
        put(homeX + 1, clawdY, 0xffffff)
        return
      }
      case 'asleep': {
        sprite(art.sleep, homeX, clawdY + 1, tint)
        // z's rise from the head, one cell at a time
        const at = Math.floor(now / 700) % 3
        const col = g.labelW + g.gap + homeX + 10
        const head = Math.floor((clawdY + 1) / 2)
        if (at >= 1 && head - 1 >= 0) text(col, head - 1, 'z', TONE.track)
        if (at >= 2 && head - 2 >= 0) text(col + 1, head - 2, 'Z', TONE.track)
        return
      }
    }
  }

  function toneOf(s: State, look: Look): number {
    if (s.kind === 'unlit') return TONE.track
    if (look.bar.color === 'leitstand') return s.kind === 'burning' ? TONE.clay : s.kind === 'cold' ? TONE.warn : TONE.bad
    if (s.kind === 'burning') return FLAME[clamp(Math.floor(s.fire * 6), 3, 5)]!
    return s.kind === 'cold' ? mix(0xf07818, ICE, 0.6) : ICE
  }

  function bar(s: State, look: Look): [string, string] {
    return (look.bar.style === 'loud' ? loudMeter : meter)(s.fraction * 100, look.bar.width)
  }

  function title(s: State, look: Look) {
    return look.bar.title === 'cache' ? 'cache' : look.bar.title === 'state' ? STATE_WORD[s.kind] : ''
  }

  // The words and the bar, in the bottom rows left of the stage
  function label(s: State, look: Look) {
    const tone = toneOf(s, look)
    const [body, rest] = bar(s, look)
    const last = g.rows - 1
    const words = title(s, look)
    if (look.bar.layout === 'stack') {
      const value = s.value.slice(0, Math.max(0, g.labelW - words.length - 1))
      text(0, last - 1, words, tone)
      text(g.labelW - value.length, last - 1, value, TONE.track)
      text(0, last, body, tone)
      text(body.length, last, rest, TONE.track)
    } else {
      text(0, last - 1, words, tone)
      text(0, last, body, tone)
      text(body.length, last, rest, TONE.track)
      text(look.bar.width, last, ` ${s.value.padStart(4)}`, TONE.track)
    }
  }

  function frame(s: State, look: Look, now: number): Drawn {
    resize(look)
    frameNo += 1
    px.fill(NONE)
    glyph.fill(0)

    if (s.throwMs === null || s.throwMs < T_IMPACT) burstDone = false
    else if (!burstDone) { burstDone = true; burst() }
    stepFire(s.fire)
    spawn(s)
    moveParticles()

    const pile = g.thrown.pile
    sprite(pile, 0, g.stageH - pile.length)
    sprite(g.furnace.art, g.furnaceX, g.furnaceY)
    drawFire(s.fire)
    drawParticles(true)
    drawClawd(s, now)
    drawParticles(false)
    label(s, look)
    return { cells: compose(), columns: g.columns, rows: g.rows }
  }

  // Two stage pixels per cell, glyphs over them
  function compose(): Uint32Array {
    const { columns, rows, stageW, labelW, gap } = g
    const cells = new Uint32Array(columns * rows * 3)
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const at = (row * columns + col) * 3
        const ch = glyph[row * columns + col]!
        if (ch) {
          cells[at] = ch; cells[at + 1] = glyphFg[row * columns + col]!; cells[at + 2] = DEFAULT
          continue
        }
        const sx = col - labelW - gap
        const top = sx >= 0 ? px[row * 2 * stageW + sx]! : NONE
        const bottom = sx >= 0 ? px[(row * 2 + 1) * stageW + sx]! : NONE
        if (top === NONE && bottom === NONE) { cells[at] = 0x20; cells[at + 1] = DEFAULT; cells[at + 2] = DEFAULT }
        else if (bottom === NONE) { cells[at] = 0x2580; cells[at + 1] = top; cells[at + 2] = DEFAULT }
        else if (top === NONE) { cells[at] = 0x2584; cells[at + 1] = bottom; cells[at + 2] = DEFAULT }
        else { cells[at] = 0x2580; cells[at + 1] = top; cells[at + 2] = bottom }
      }
    }
    return cells
  }

  // One row for a narrow terminal: title, bar, time
  function line(s: State, look: Look): Drawn {
    const columns = lineColumns(look)
    const tone = toneOf(s, look)
    const [body, rest] = bar(s, look)
    const words = look.bar.title === 'none' ? '' : title(s, look).padEnd(8)
    const parts: [string, number][] = [[words, tone], [body, tone], [rest, TONE.track], [` ${s.value.padStart(4)}`, TONE.track]]
    const cells = new Uint32Array(columns * 3)
    let c = 0
    for (const [str, fg] of parts) {
      for (const ch of str) {
        if (c >= columns) break
        cells[c * 3] = ch.codePointAt(0)!; cells[c * 3 + 1] = fg; cells[c * 3 + 2] = DEFAULT
        c++
      }
    }
    for (; c < columns; c++) { cells[c * 3] = 0x20; cells[c * 3 + 1] = DEFAULT; cells[c * 3 + 2] = DEFAULT }
    return { cells, columns, rows: 1 }
  }

  return { frame, line }
}

export function toBase64(cells: Uint32Array): string {
  // Little-endian words, as RasterProps asks. The environment has toBase64; lib es2023 does not type it
  const bytes = new Uint8Array(cells.buffer, cells.byteOffset, cells.byteLength) as Uint8Array & { toBase64(): string }
  return bytes.toBase64()
}
