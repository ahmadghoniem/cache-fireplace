// Runs the scene through each state and writes the frames as JSON,
// for render-preview.py to turn into a GIF and a contact sheet.
// Run: bun tools/preview.ts tools/out/frames.json
import { THROW_MS, derive, frame } from '../hooks/scene'

const MIN = 60_000
const TTL = 60 * MIN
const STEP = 125
type Shot = { title: string; ms: number; lastAgo: number | null; isThrow?: boolean }
const shots: Shot[] = [
  { title: 'unlit, first prompt', ms: THROW_MS + 1000, lastAgo: null, isThrow: true },
  { title: 'burning, 50m left', ms: 1000, lastAgo: 10 * MIN },
  { title: 'burning, 20m left', ms: 1000, lastAgo: 40 * MIN },
  { title: 'prompt at 20m left', ms: THROW_MS + 1000, lastAgo: 40 * MIN, isThrow: true },
  { title: 'cooling, 6m left', ms: 2500, lastAgo: 54 * MIN },
  { title: 'cooling, 1m left', ms: 1000, lastAgo: 59 * MIN },
  { title: 'expired', ms: 2500, lastAgo: 70 * MIN },
]
const out: { title: string; cols: number; rows: number; cells: number[] }[] = []
const base = 1_790_000_000_000
for (const s of shots) {
  for (let t = 0; t < s.ms; t += STEP) {
    const now = base + t
    // A prompt's request goes out right after it is sent
    const last = s.isThrow && t > 200 ? base + 200 : s.lastAgo === null ? null : base - s.lastAgo
    const drawn = frame(derive({ now, lastRequestAt: last, ttlMs: TTL, throwAt: s.isThrow ? base : null }), now)
    out.push({ title: s.title, cols: drawn.columns, rows: drawn.rows, cells: [...drawn.cells] })
  }
}
const cols = Math.max(...out.map(f => f.cols))
const rows = Math.max(...out.map(f => f.rows))
await Bun.write(process.argv[2] ?? 'frames.json', JSON.stringify({ cols, rows, step: STEP, frames: out }))
