import { expect, mock, test } from 'claude-code/testing'

import { isThrow } from './register'
import { COLS, COMPACT_COLS, ROWS, clock, createScene, phase } from './scene'
import { PAL } from './sprites'

const MIN = 60_000
const T0 = 1_790_000_000_000
const HOUR = 60 * MIN

const blits: { requestId: string; key: string; cells: string }[] = []
// Whether a test's band is up: the kit does not name its requestId
const band = { isMounted: false }

type Node = { type?: string; props?: Record<string, unknown>; children?: unknown[] }
const rasters = (n: unknown): Node[] => {
  if (!n || typeof n !== 'object') return []
  if (Array.isArray(n)) return n.flatMap(rasters)
  const node = n as Node
  return [...(node.type === 'Raster' ? [node] : []), ...rasters(node.children ?? node.props?.children)]
}
const draw = async ($: any, bodyColumns = 120, hasSurvey = false) => {
  const ui = await $.ui.mount({ plugin: 'clawd-furnace', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey, isWorking: false, maxRows: 12, bodyColumns } as never })
  const tree = await ui.drawn()
  await ui.unmount()
  return rasters(tree)
}
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
  on('ui.render', () => ({ type: 'Box', props: {}, children: [] }))
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

// How it can fail: the wrong phase for the time left, a cold furnace while there is plenty of time
test('phases follow the time since the last request', () => {
  const at = (ago: number) => phase({ now: T0, lastRequestAt: T0 - ago, ttlMs: HOUR, throwAt: null })
  expect(phase({ now: T0, lastRequestAt: null, ttlMs: HOUR, throwAt: null }).kind).toBe('unlit')
  expect(at(5 * MIN).kind).toBe('burning')
  expect(at(49 * MIN).kind).toBe('burning')
  expect(at(51 * MIN).kind).toBe('cold')
  expect(at(61 * MIN).kind).toBe('out')
  // A 5-minute cache gets cold in its last third, not from the start
  expect(phase({ now: T0, lastRequestAt: T0 - MIN, ttlMs: 5 * MIN, throwAt: null }).kind).toBe('burning')
  expect(clock(47 * MIN)).toBe('47m')
  expect(clock(6 * MIN + 5000)).toBe('6:05')
})

test('the full scene is drawn where it fits, one line where it does not, nothing when too narrow', async ($, on) => {
  await world($, on)
  const [wide] = await draw($, 120)
  expect(wide?.props).toMatchObject({ key: 'furnace', columns: COLS, rows: ROWS })
  const [narrow] = await draw($, 40)
  expect(narrow?.props).toMatchObject({ columns: COMPACT_COLS, rows: 1 })
  expect(textOf(narrow!.props!.cells as string)).toContain('unlit')
  expect(await draw($, 20)).toHaveLength(0)
  expect(await draw($, 120, true)).toHaveLength(0)
})

test('a request starts the hour; a subagent request does not', async ($, on) => {
  const time = await world($, on, {}, false)
  await step($, 'agent-1')
  expect(textOf((await draw($, 40))[0]!.props!.cells as string)).toContain('unlit')
  await step($)
  await time.advance(13 * MIN)
  expect(textOf((await draw($, 40))[0]!.props!.cells as string)).toContain('47m left')
  await time.advance(42 * MIN)
  expect(textOf((await draw($, 40))[0]!.props!.cells as string)).toContain('5:00 left')
  await time.advance(10 * MIN)
  expect(textOf((await draw($, 40))[0]!.props!.cells as string)).toContain('expired 5:00')
})

test('CLAWD_FURNACE_TTL_MINUTES sets the cache length', async ($, on) => {
  const time = await world($, on, { CLAWD_FURNACE_TTL_MINUTES: '5' })
  await step($)
  await time.advance(MIN)
  expect(textOf((await draw($, 40))[0]!.props!.cells as string)).toContain('4:00 left')
})

test('a typed prompt throws a log; slash commands and notifications do not', async ($, on) => {
  expect(isThrow('fix the bug', 'composer')).toBe(true)
  expect(isThrow('  /furnace', 'composer')).toBe(false)
  expect(isThrow('<task-notification>', 'task-notification')).toBe(false)
  // The prompt goes through untouched
  await world($, on)
  expect(await $.prompt.submit({ text: 'fix the bug', origin: { kind: 'composer' } } as never)).toMatchObject({ text: 'fix the bug' })
})

test('the thrown log flies into the furnace', () => {
  const logs = (cells: Uint32Array) => {
    let n = 0
    for (let i = 0; i < cells.length; i += 3) if (cells[i + 1] === PAL.W || cells[i + 2] === PAL.W) n++
    return n
  }
  const inp = { now: T0 + 900, lastRequestAt: T0, ttlMs: HOUR, throwAt: null }
  expect(logs(createScene().frame({ ...inp, throwAt: T0 }))).toBeGreaterThan(logs(createScene().frame(inp)))
})

test('the frame timer repaints the mounted band and stops once it is gone', async ($, on) => {
  const time = await world($, on)
  const ui = await $.ui.mount({ plugin: 'clawd-furnace', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 120 } as never })
  band.isMounted = true
  await step($)
  await time.advance(500)
  expect(blits.length).toBeGreaterThanOrEqual(3)
  expect(blits[0]).toMatchObject({ key: 'furnace' })
  // Each frame differs: the fire burns
  expect(new Set(blits.map(b => b.cells)).size).toBe(blits.length)
  band.isMounted = false
  await ui.unmount()
  await time.advance(250)
  const after = blits.length
  await time.advance(500)
  expect(blits.length).toBe(after)
})

test('/furnace hides and shows the band', async ($, on) => {
  await world($, on)
  await $.command.run({ command: 'furnace', args: '' } as never)
  expect(await draw($)).toHaveLength(0)
  await $.command.run({ command: 'furnace', args: '' } as never)
  expect(await draw($)).toHaveLength(1)
})

test('the scene animates and the compact line fits its columns', () => {
  const scene = createScene()
  const inp = { now: T0, lastRequestAt: T0, ttlMs: HOUR, throwAt: T0 }
  expect(scene.frame(inp)).toHaveLength(COLS * ROWS * 3)
  expect(scene.compact(inp)).toHaveLength(COMPACT_COLS * 3)
  const a = scene.frame({ ...inp, now: T0 + 500 })
  const b = scene.frame({ ...inp, now: T0 + 625 })
  expect(a).not.toEqual(b)
})
