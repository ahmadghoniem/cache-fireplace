// Writes the sprites and two scene frames as JSON for make-attachments.py.
// Run: bun tools/handoff/dump.ts tools/out/sprites.json
import { LOOK } from '../../hooks/look'
import { createScene, derive } from '../../hooks/scene'
import { CLAWDS, FURNACES, PAL, SCARF, THROWN } from '../../hooks/sprites'

const MIN = 60_000
const now = 1_790_000_000_000
const shot = (ago: number) => {
  const scene = createScene(5)
  const inp = { now, lastRequestAt: now - ago, ttlMs: 60 * MIN, throwAt: null }
  // A few frames in, so the fire has risen
  let drawn = scene.frame(derive(inp, LOOK), LOOK, now)
  for (let i = 1; i < 12; i++) drawn = scene.frame(derive({ ...inp, now: now + i * 125 }, LOOK), LOOK, now + i * 125)
  return { columns: drawn.columns, rows: drawn.rows, cells: [...drawn.cells] }
}
await Bun.write(process.argv[2] ?? 'sprites.json', JSON.stringify({
  pal: PAL, clawds: CLAWDS, scarf: SCARF, furnaces: FURNACES, thrown: THROWN,
  scenes: { burning: shot(25 * MIN), cold: shot(56 * MIN) },
}))
