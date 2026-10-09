// Writes the sprites and two scene frames as JSON for make-attachments.py.
// Run: bun tools/handoff/dump.ts tools/out/sprites.json
import { derive, frame } from '../../hooks/scene'
import { CLAWD, FIREPLACE, LOG, PAL, SCARF, WOODPILE } from '../../hooks/sprites'

const MIN = 60_000
const now = 1_790_000_000_000
const shot = (ago: number) => {
  const drawn = frame(derive({ now, lastRequestAt: now - ago, ttlMs: 60 * MIN, throwAt: null }), now)
  return { columns: drawn.columns, rows: drawn.rows, cells: [...drawn.cells] }
}
await Bun.write(process.argv[2] ?? 'sprites.json', JSON.stringify({
  pal: PAL, clawd: CLAWD, scarf: SCARF, fireplace: FIREPLACE, woodpile: WOODPILE, log: LOG,
  scenes: { burning: shot(25 * MIN), cold: shot(56 * MIN) },
}))
