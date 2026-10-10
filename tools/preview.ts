// Runs the scene through each state and writes the frames as JSON,
// for render-preview.py to turn into a GIF and a contact sheet.
// Run: bun tools/preview.ts tools/out/frames.json
import { COLUMNS, POKE_MS, ROWS, ROW_COLUMNS, STAGE, THROW_MS, derive, frame } from '../hooks/scene'

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
// The video puts the bar and the time under the scene, centered, instead of left of it,
// so the scene sits in the middle of the frame. A blank row between them
function stacked(cells: Uint32Array) {
  const left = COLUMNS - STAGE.w, rows = ROWS + 2, barX = (STAGE.w - ROW_COLUMNS) >> 1
  const res: number[] = []
  for (let i = 0; i < STAGE.w * rows; i++) res.push(0x20, 0x01000000, 0x01000000)
  const copy = (r: number, k: number, to: number, toK: number) => {
    for (let j = 0; j < 3; j++) res[(to * STAGE.w + toK) * 3 + j] = cells[(r * COLUMNS + k) * 3 + j]!
  }
  for (let r = 0; r < ROWS; r++) for (let x = 0; x < STAGE.w; x++) copy(r, left + x, r, x)
  for (let k = 0; k < ROW_COLUMNS; k++) copy(ROWS - 1, k, rows - 1, barX + k)
  return { cols: STAGE.w, rows, cells: res }
}
// A multiple of the rub (6 s) and look-out (17 s) cycles: each shot starts as he begins rubbing his hands
const base = 1_790_000_040_000
for (const s of shots) {
  for (let t = 0; t < s.ms; t += STEP) {
    const now = base + t
    // A prompt's request goes out right after it is sent
    const last = s.act && t > 200 ? base + 200 : s.lastAgo === null ? null : base - s.lastAgo
    const drawn = frame(derive({ now, lastRequestAt: last, throwAt: s.act === 'throw' ? base : null, pokeAt: s.act === 'poke' ? base : null }), now)
    out.push({ title: s.title, ...stacked(drawn.cells) })
  }
}
const cols = Math.max(...out.map(f => f.cols))
const rows = Math.max(...out.map(f => f.rows))
await Bun.write(process.argv[2] ?? 'frames.json', JSON.stringify({ cols, rows, step: STEP, frames: out }))
