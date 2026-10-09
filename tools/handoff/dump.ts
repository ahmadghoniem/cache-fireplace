// Writes the fireplace and log sprites and a scene frame as JSON for make-attachments.py.
// Run: bun tools/handoff/dump.ts tools/out/sprites.json
import { derive, frame } from '../../hooks/scene'
import { FIREPLACE, LOG, PAL, WOODPILE } from '../../hooks/sprites'

const MIN = 60_000
const now = 1_790_000_000_000
const drawn = frame(derive({ now, lastRequestAt: now - 25 * MIN, throwAt: null, pokeAt: null }), now)
await Bun.write(process.argv[2] ?? 'sprites.json', JSON.stringify({
  pal: PAL, fireplace: FIREPLACE, woodpile: WOODPILE, log: LOG,
  scene: { columns: drawn.columns, rows: drawn.rows, cells: [...drawn.cells] },
}))
