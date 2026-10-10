// Runs the scene through each state and writes the frames as JSON,
// for render-preview.py to turn into a GIF and a contact sheet.
// Run: bun tools/preview.ts tools/out/frames.json
import { POKE_MS, THROW_MS, derive, frame } from '../hooks/scene'

const MIN = 60_000
const STEP = 125
type Shot = { title: string; ms: number; lastAgo: number | null; act?: 'throw' | 'poke' }
const shots: Shot[] = [
  { title: 'unlit, first prompt: a log', ms: THROW_MS + 1000, lastAgo: null, act: 'throw' },
  { title: 'burning, 50m left', ms: 1000, lastAgo: 10 * MIN },
  { title: 'prompt at 40m left: a poke', ms: POKE_MS + 1000, lastAgo: 20 * MIN, act: 'poke' },
  { title: 'cold, 15m left', ms: 2500, lastAgo: 45 * MIN },
  { title: 'cold, 4m left', ms: 2000, lastAgo: 56 * MIN },
  { title: 'expired', ms: 2500, lastAgo: 70 * MIN },
]
const out: { title: string; cols: number; rows: number; cells: number[] }[] = []
// A multiple of the rub (6 s) and look-out (17 s) cycles: each shot starts as he begins rubbing his hands
const base = 1_790_000_040_000
for (const s of shots) {
  for (let t = 0; t < s.ms; t += STEP) {
    const now = base + t
    // A prompt's request goes out right after it is sent
    const last = s.act && t > 200 ? base + 200 : s.lastAgo === null ? null : base - s.lastAgo
    const drawn = frame(derive({ now, lastRequestAt: last, throwAt: s.act === 'throw' ? base : null, pokeAt: s.act === 'poke' ? base : null }), now)
    out.push({ title: s.title, cols: drawn.columns, rows: drawn.rows, cells: [...drawn.cells] })
  }
}
const cols = Math.max(...out.map(f => f.cols))
const rows = Math.max(...out.map(f => f.rows))
await Bun.write(process.argv[2] ?? 'frames.json', JSON.stringify({ cols, rows, step: STEP, frames: out }))
