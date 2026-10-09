import { expect, mock, test } from 'claude-code/testing'

import { isThrow } from './register'
import { COLUMNS, ROWS, ROW_COLUMNS, T_IMPACT, clock, derive, frame, line, phase } from './scene'
import type { Inputs } from './scene'
import { PAL } from './sprites'

const MIN = 60_000
const T0 = 1_790_000_000_000
const HOUR = 60 * MIN

const blits: { requestId: string; key: string; cells: string }[] = []
// Whether a test's band is up: the kit does not name its requestId. `below` is what the plugins beneath draw
const band: { isMounted: boolean; below: unknown } = { isMounted: false, below: { type: 'engine', ref: 0 } }

type Node = { type?: string; props?: Record<string, unknown>; children?: unknown[] }
const rasters = (n: unknown): Node[] => {
  if (!n || typeof n !== 'object') return []
  if (Array.isArray(n)) return n.flatMap(rasters)
  const node = n as Node
  return [...(node.type === 'Raster' ? [node] : []), ...rasters(node.children ?? node.props?.children)]
}
const mount = async ($: any, bodyColumns = 120, hasSurvey = false) => {
  const ui = await $.ui.mount({ plugin: 'clawd-furnace', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey, isWorking: false, maxRows: 12, bodyColumns } as never })
  const tree = await ui.drawn()
  await ui.unmount()
  return tree
}
const draw = async ($: any, bodyColumns = 120, hasSurvey = false) => rasters(await mount($, bodyColumns, hasSurvey))
// The text of a one-row Raster
const textOf = (cells: string) => {
  const bytes = (Uint8Array as unknown as { fromBase64(s: string): Uint8Array }).fromBase64(cells)
  const words = new Uint32Array(bytes.buffer)
  let s = ''
  for (let i = 0; i < words.length; i += 3) s += String.fromCodePoint(words[i]!)
  return s
}
// `isStarted: false` leaves the frame timer off, so the clock can jump by the hour
const world = async ($: any, on: any, env: Record<string, string> = {}, isStarted = true) => {
  const time = mock.clock(on, { now: T0 })
  mock.env(on, env)
  mock.store(on)
  band.below = { type: 'engine', ref: 0 }
  on('ui.render', () => band.below)
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('prompt.submit', (_: unknown, e: any) => ({ text: e.text }))
  on('command.register', (_: unknown, e: any) => ({ value: { command: e.name } }))
  on('turn.step', async function* (_: unknown, e: any) { return { turnId: e.turnId, index: e.index, answer: '', toolUses: [] } as never })
  // Repaints of a band still mounted; one unmounted is denied, as the engine does
  blits.length = 0
  band.isMounted = false
  on('ui.blit', (_: unknown, e: any) => {
    if (!band.isMounted) return { deny: 'not mounted' }
    blits.push(e)
    return { value: {} }
  })
  if (isStarted) await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  return time
}
const step = async ($: any, agentId?: string) => {
  const stream = $.turn.step({ turnId: 't', index: 0, model: 'claude-opus-5-5', messageCount: 1, ...(agentId ? { agentId } : {}) })
  for await (const _ of stream) {}
}

// How it can fail: the wrong phase for the time left, a cold fire while there is plenty of time
test('phases follow the time since the last request', () => {
  const at = (ago: number) => phase({ now: T0, lastRequestAt: T0 - ago, ttlMs: HOUR, throwAt: null })
  expect(phase({ now: T0, lastRequestAt: null, ttlMs: HOUR, throwAt: null }).kind).toBe('unlit')
  expect(at(5 * MIN).kind).toBe('burning')
  expect(at(49 * MIN).kind).toBe('burning')
  expect(at(51 * MIN).kind).toBe('cold')
  expect(at(61 * MIN).kind).toBe('expired')
  // A 5-minute cache gets cold in its last third, not from the start
  expect(phase({ now: T0, lastRequestAt: T0 - MIN, ttlMs: 5 * MIN, throwAt: null }).kind).toBe('burning')
  expect(clock(47 * MIN)).toBe('47m')
  expect(clock(6 * MIN + 5000)).toBe('6:05')
})

test('the full scene is drawn where it fits, one line where it does not, nothing when too narrow', async ($, on) => {
  await world($, on)
  const [wide] = await draw($, 120)
  expect(wide?.props).toMatchObject({ key: 'fireplace', columns: COLUMNS, rows: ROWS })
  // 25% under the first version's 8 rows
  expect(ROWS).toBe(6)
  const [narrow] = await draw($, COLUMNS - 1)
  expect(narrow?.props).toMatchObject({ columns: ROW_COLUMNS, rows: 1 })
  expect(textOf(narrow!.props!.cells as string)).toContain('cache')
  expect(await draw($, ROW_COLUMNS - 1)).toHaveLength(0)
  expect(await draw($, 120, true)).toHaveLength(0)
})

// How it can fail: the fireplace hides what another plugin draws in the band, or takes the whole row for itself
test('what the plugins beneath draw keeps the left of the band', async ($, on) => {
  await world($, on)
  const alone = (await mount($)) as Node
  expect(alone.props).toMatchObject({ justifyContent: 'flex-end' })
  band.below = { type: 'Text', props: {}, children: ['leitstand'] }
  const shared = (await mount($)) as Node
  const [left, right] = shared.children as Node[]
  expect(JSON.stringify(left)).toContain('leitstand')
  expect(left!.props).toMatchObject({ flexGrow: 1 })
  expect(right).toMatchObject({ type: 'Raster', props: { columns: COLUMNS } })
})

test('a request starts the hour; a subagent request does not', async ($, on) => {
  const time = await world($, on, {}, false)
  await step($, 'agent-1')
  const text = async () => textOf((await draw($, ROW_COLUMNS))[0]!.props!.cells as string)
  expect(await text()).toContain('unlit')
  expect(await text()).not.toMatch(/\d/)
  await step($)
  await time.advance(13 * MIN)
  expect(await text()).toMatch(/✱ burning +cache .*47m/)
  await time.advance(42 * MIN)
  expect(await text()).toMatch(/! cooling .*5:00/)
  await time.advance(10 * MIN)
  expect(await text()).toMatch(/! expired .*out/)
})

test('CLAWD_FURNACE_TTL_MINUTES sets the cache length', async ($, on) => {
  const time = await world($, on, { CLAWD_FURNACE_TTL_MINUTES: '5' })
  await step($)
  await time.advance(MIN)
  expect(textOf((await draw($, ROW_COLUMNS))[0]!.props!.cells as string)).toContain('4:00')
})

test('a typed prompt throws a log; slash commands and notifications do not', async ($, on) => {
  expect(isThrow('fix the bug', 'composer')).toBe(true)
  expect(isThrow('  /fireplace', 'composer')).toBe(false)
  expect(isThrow('<task-notification>', 'task-notification')).toBe(false)
  // The prompt goes through untouched
  await world($, on)
  expect(await $.prompt.submit({ text: 'fix the bug', origin: { kind: 'composer' } } as never)).toMatchObject({ text: 'fix the bug' })
})

const count = (cells: Uint32Array, color: number) => {
  let n = 0
  for (let i = 0; i < cells.length; i += 3) if (cells[i + 1] === color || cells[i + 2] === color) n++
  return n
}
const cellsAt = (inp: Inputs) => frame(derive(inp), inp.now).cells

test('the thrown log flies into the fire, which flares', () => {
  const inp = { now: T0 + 1125, lastRequestAt: T0, ttlMs: HOUR, throwAt: null }
  // In the air: one log more than the pile and the grate hold
  expect(count(cellsAt({ ...inp, throwAt: T0 }), PAL.W!)).toBeGreaterThan(count(cellsAt(inp), PAL.W!))
  // A low fire burns higher once the log lands
  const later = { now: T0 + 40 * MIN, lastRequestAt: T0, ttlMs: HOUR }
  const flame = (throwAt: number | null) => {
    const cells = cellsAt({ ...later, throwAt })
    return count(cells, PAL.F!) + count(cells, PAL.f!) + count(cells, PAL.y!)
  }
  expect(flame(later.now - T_IMPACT - 200)).toBeGreaterThan(flame(null))
})

// How it can fail: the scarf on a warm Clawd, or the fire still burning in the cold
test('cold and expired share the scarf; the fireplace tells them apart', () => {
  const at = (ago: number) => cellsAt({ now: T0, lastRequestAt: T0 - ago, ttlMs: HOUR, throwAt: null })
  const burning = at(20 * MIN), cold = at(55 * MIN), expired = at(70 * MIN)
  expect(count(burning, PAL.B!)).toBe(0)
  expect(count(cold, PAL.B!)).toBeGreaterThan(0)
  expect(count(expired, PAL.B!)).toBe(count(cold, PAL.B!))
  expect(count(burning, PAL.y!)).toBeGreaterThan(0)
  expect(count(cold, PAL.y!)).toBe(0)
  expect(count(cold, PAL.a!)).toBe(0)
  expect(count(expired, PAL.a!)).toBeGreaterThan(0)
})

test('the frame timer repaints the mounted band and stops once it is gone', async ($, on) => {
  const time = await world($, on)
  const ui = await $.ui.mount({ plugin: 'clawd-furnace', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 120 } as never })
  band.isMounted = true
  await step($)
  await time.advance(1000)
  expect(blits.length).toBeGreaterThanOrEqual(3)
  expect(blits[0]).toMatchObject({ key: 'fireplace' })
  // Only a changed frame is sent: the fire burns
  for (let i = 1; i < blits.length; i++) expect(blits[i]!.cells).not.toBe(blits[i - 1]!.cells)
  band.isMounted = false
  await ui.unmount()
  await time.advance(250)
  const after = blits.length
  await time.advance(500)
  expect(blits.length).toBe(after)
})

test('/fireplace hides and shows the band', async ($, on) => {
  await world($, on)
  await $.command.run({ command: 'fireplace', args: '' } as never)
  expect(await draw($)).toHaveLength(0)
  await $.command.run({ command: 'fireplace', args: '' } as never)
  expect(await draw($)).toHaveLength(1)
})

test('the scene animates and the compact line fits its columns', () => {
  const inp = { now: T0, lastRequestAt: T0, ttlMs: HOUR, throwAt: T0 }
  const at = (now: number) => cellsAt({ ...inp, now })
  expect(at(T0)).toHaveLength(COLUMNS * ROWS * 3)
  expect(line(derive(inp)).cells).toHaveLength(ROW_COLUMNS * 3)
  // The same moment draws the same frame
  expect(at(T0 + 500)).toEqual(at(T0 + 500))
  expect(at(T0 + 3000)).not.toEqual(at(T0 + 3160))
})
