// Runs the scene through a session in each concept and writes the frames as JSON,
// for render-preview.py to turn into a GIF and a contact sheet.
// Run: bun tools/preview.ts tools/out/frames.json [size 75|60]
import { LOOK } from '../hooks/look'
import { createScene, derive, geometry } from '../hooks/scene'
import type { Look } from '../hooks/scene'

const MIN = 60_000
const TTL = 60 * MIN
const STEP = 125
const size = Number(process.argv[3] ?? LOOK.size) as Look['size']
type Shot = { title: string; ms: number; lastAgo: number | null; throwAt?: number; look?: Partial<Look> }
const shots: Shot[] = [
  { title: 'unlit, first prompt', ms: 2600, lastAgo: null, throwAt: 0 },
  { title: 'burning steady 35m', ms: 1000, lastAgo: 25 * MIN },
  { title: 'burning plume 35m', ms: 1000, lastAgo: 25 * MIN, look: { burning: 'plume' } },
  { title: 'burning warm 35m', ms: 1000, lastAgo: 25 * MIN, look: { burning: 'warm' } },
  { title: 'cold shiver 4m', ms: 1000, lastAgo: 56 * MIN },
  { title: 'cold scarf 4m', ms: 1000, lastAgo: 56 * MIN, look: { cold: 'scarf' } },
  { title: 'cold huddle 4m', ms: 1000, lastAgo: 56 * MIN, look: { cold: 'huddle' } },
  { title: 'expired ice', ms: 1000, lastAgo: 70 * MIN },
  { title: 'expired asleep', ms: 1500, lastAgo: 70 * MIN, look: { expired: 'asleep' } },
  { title: 'expired smoke', ms: 1000, lastAgo: 70 * MIN, look: { expired: 'smoke' } },
  { title: 'coal, box stove, quiet line bar', ms: 2600, lastAgo: 30 * MIN, throwAt: 0, look: { thrown: 'coal', furnace: 'box stove', bar: { ...LOOK.bar, style: 'quiet', layout: 'line', title: 'state' } } },
  { title: 'page, fire-colored bar', ms: 2600, lastAgo: 50 * MIN, throwAt: 0, look: { thrown: 'page', bar: { ...LOOK.bar, color: 'fire', title: 'state' } } },
]
const out: { title: string; cols: number; rows: number; cells: number[] }[] = []
const base = 1_790_000_000_000
for (const s of shots) {
  const look: Look = { ...LOOK, size, ...s.look }
  const scene = createScene()
  const g = geometry(look)
  for (let t = 0; t < s.ms; t += STEP) {
    const now = base + t
    // A prompt's request goes out right after it is sent
    const last = s.throwAt !== undefined && t > 200 ? now - (t - 200) : s.lastAgo === null ? null : base - s.lastAgo
    const state = derive({ now, lastRequestAt: last, ttlMs: TTL, throwAt: s.throwAt === undefined ? null : base + s.throwAt }, look)
    out.push({ title: s.title, cols: g.columns, rows: g.rows, cells: [...scene.frame(state, look, now).cells] })
  }
}
const cols = Math.max(...out.map(f => f.cols))
const rows = Math.max(...out.map(f => f.rows))
await Bun.write(process.argv[2] ?? 'frames.json', JSON.stringify({ cols, rows, step: STEP, frames: out }))
