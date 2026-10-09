import { expect, mock, test } from 'claude-code/testing'

import { LOOK } from './look'
import { isThrow } from './register'
import { clock, createScene, derive, geometry, lineColumns, phase } from './scene'
import type { Inputs } from './scene'
import { PAL } from './sprites'

const MIN = 60_000
const T0 = 1_790_000_000_000
const HOUR = 60 * MIN

const blits: { requestId: string; key: string; cells: string }[] = []
// Whether a test's band is up: the kit does not name its requestId. `below` is what the plugins beneath draw
const band: { isMounted: boolean; below: unknown } = { isMounted: false, below: { type: 'engine', ref: 0 } }
const FULL = geometry(LOOK)

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

// How it can fail: the wrong phase for the time left, a cold furnace while there is plenty of time
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
  expect(wide?.props).toMatchObject({ key: 'furnace', columns: FULL.columns, rows: FULL.rows })
  // 25% under the first version's 53 x 8
  expect(FULL.columns).toBeLessThanOrEqual(45)
  expect(FULL.rows).toBe(6)
  const [narrow] = await draw($, FULL.columns - 1)
  expect(narrow?.props).toMatchObject({ columns: lineColumns(LOOK), rows: 1 })
  expect(textOf(narrow!.props!.cells as string)).toContain('cache')
  expect(await draw($, lineColumns(LOOK) - 1)).toHaveLength(0)
  expect(await draw($, 120, true)).toHaveLength(0)
})

// How it can fail: the furnace hides what another plugin draws in the band, or takes the whole row for itself
test('what the plugins beneath draw keeps the left of the band', async ($, on) => {
  await world($, on)
  const alone = (await mount($)) as Node
  expect(alone.props).toMatchObject({ justifyContent: 'flex-end' })
  band.below = { type: 'Text', props: {}, children: ['leitstand'] }
  const shared = (await mount($)) as Node
  const [left, right] = shared.children as Node[]
  expect(JSON.stringify(left)).toContain('leitstand')
  expect(left!.props).toMatchObject({ flexGrow: 1 })
  expect(right).toMatchObject({ type: 'Raster', props: { columns: FULL.columns } })
})

test('a request starts the hour; a subagent request does not', async ($, on) => {
  const time = await world($, on, {}, false)
  await step($, 'agent-1')
  const line = async () => textOf((await draw($, 30))[0]!.props!.cells as string)
  expect(await line()).not.toMatch(/\d/)
  await step($)
  await time.advance(13 * MIN)
  expect(await line()).toContain('47m')
  await time.advance(42 * MIN)
  expect(await line()).toContain('5:00')
  await time.advance(10 * MIN)
  expect(await line()).toContain('out')
})

test('CLAWD_FURNACE_TTL_MINUTES sets the cache length', async ($, on) => {
  const time = await world($, on, { CLAWD_FURNACE_TTL_MINUTES: '5' })
  await step($)
  await time.advance(MIN)
  expect(textOf((await draw($, 30))[0]!.props!.cells as string)).toContain('4:00')
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
  const frame = (inp: Inputs) => createScene().frame(derive(inp, LOOK), LOOK, inp.now).cells
  const inp = { now: T0 + 900, lastRequestAt: T0, ttlMs: HOUR, throwAt: null }
  expect(logs(frame({ ...inp, throwAt: T0 }))).toBeGreaterThan(logs(frame(inp)))
})

// How it can fail: a concept picked in the tuner draws the same as another
test('each concept for a state draws differently', () => {
  const inp = (ago: number) => ({ now: T0, lastRequestAt: T0 - ago, ttlMs: HOUR, throwAt: null })
  const drawn = (look: typeof LOOK, ago: number) => {
    const scene = createScene(1)
    return [...scene.frame(derive(inp(ago), look), look, T0).cells].join()
  }
  for (const [key, names, ago] of [['burning', ['steady', 'warm'], 20 * MIN], ['cold', ['shiver', 'scarf', 'huddle'], 58 * MIN], ['expired', ['ice', 'asleep', 'smoke'], 70 * MIN]] as const) {
    const frames = names.map(name => drawn({ ...LOOK, [key]: name }, ago))
    expect(new Set(frames).size).toBe(names.length)
  }
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
  const at = (now: number) => scene.frame(derive({ ...inp, now }, LOOK), LOOK, now).cells
  expect(at(T0)).toHaveLength(FULL.columns * FULL.rows * 3)
  expect(scene.line(derive(inp, LOOK), LOOK).cells).toHaveLength(lineColumns(LOOK) * 3)
  for (const size of [75, 60] as const) {
    const g = geometry({ ...LOOK, size })
    expect(createScene().frame(derive(inp, LOOK), { ...LOOK, size }, T0).cells).toHaveLength(g.columns * g.rows * 3)
  }
  expect(at(T0 + 500)).not.toEqual(at(T0 + 625))
})
