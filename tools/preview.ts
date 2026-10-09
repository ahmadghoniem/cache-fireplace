// Runs the scene through a few minutes of a session and writes its frames as JSON,
// for render-preview.py to turn into a GIF. Run: bun tools/preview.ts out/frames.json
import { COLS, ROWS, createScene } from '../hooks/scene'

const MIN = 60_000
const TTL = 60 * MIN
const STEP = 125
type Shot = { title: string; ms: number; lastAgo: number | null; throwAt?: number }
const shots: Shot[] = [
  { title: 'unlit, first prompt', ms: 2600, lastAgo: null, throwAt: 0 },
  { title: '58m left, new prompt', ms: 2600, lastAgo: 2 * MIN, throwAt: 0 },
  { title: '35m left', ms: 1500, lastAgo: 25 * MIN },
  { title: '15m left', ms: 1500, lastAgo: 45 * MIN },
  { title: '6m left, cold', ms: 2000, lastAgo: 54 * MIN },
  { title: '1m left, cold', ms: 2000, lastAgo: 59 * MIN },
  { title: 'expired', ms: 2000, lastAgo: 75 * MIN },
  { title: 'expired, new prompt', ms: 2600, lastAgo: 75 * MIN, throwAt: 0 },
]
const scene = createScene()
const out: { title: string; cells: number[] }[] = []
const base = 1_790_000_000_000
for (const s of shots) {
  for (let t = 0; t < s.ms; t += STEP) {
    const now = base + t
    // A prompt's request goes out right after it is sent
    const last = s.throwAt !== undefined && t > 200 ? now - (t - 200) : s.lastAgo === null ? null : base - s.lastAgo
    const cells = scene.frame({ now, lastRequestAt: last, ttlMs: TTL, throwAt: s.throwAt === undefined ? null : base + s.throwAt })
    out.push({ title: s.title, cells: [...cells] })
  }
}
await Bun.write(process.argv[2] ?? 'frames.json', JSON.stringify({ cols: COLS, rows: ROWS, step: STEP, frames: out }))
