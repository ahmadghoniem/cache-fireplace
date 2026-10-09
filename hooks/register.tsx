import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { COLUMNS, ROWS, ROW_COLUMNS, derive, frame, line, toBase64 } from './scene'
import type { Inputs } from './scene'
import type { Moment } from '../types'

const lastRequestAt = atom({ plugin: 'clawd-furnace', key: 'lastRequestAt' } as const, null)
const throwAt = atom({ plugin: 'clawd-furnace', key: 'throwAt' } as const, null)
const isHidden = atom({ plugin: 'clawd-furnace', key: 'isHidden' } as const, false)

const KEY = 'fireplace'
// 8 frames a second, as the mascot GIFs run
const FRAME_MS = 125
const DEFAULT_TTL_MIN = 60

// The band picks a size from the room it gets: the full scene, one line, or nothing
type Size = 'full' | 'line'
const sizeFor = (bodyColumns: number, maxRows: number): Size | null =>
  bodyColumns >= COLUMNS && maxRows >= ROWS ? 'full' : bodyColumns >= ROW_COLUMNS ? 'line' : null

// A prompt the person typed, not a slash command or a notification
export const isThrow = (text: string, origin: string | undefined) =>
  (origin === 'composer' || origin === 'bridge' || origin === 'sdk') && !text.trimStart().startsWith('/')

export const register: Register = on => {
  let ttlMs = DEFAULT_TTL_MIN * 60_000
  // The timer reads these; the atoms hold the same and survive a reload
  let last: Moment = null
  let thrown: Moment = null
  // The band drawn now, for the timer to repaint
  let site: { requestId: string; size: Size } | null = null
  let isBusy = false
  // What the band shows now: a frame like the last is not sent again
  let shown = ''

  const draw = (size: Size, inp: Inputs) => {
    const state = derive(inp)
    return toBase64((size === 'full' ? frame(state, inp.now) : line(state)).cells)
  }

  on('session.start', async ($, e, next) => {
    const minutes = Number(await $.env.get('CLAWD_FURNACE_TTL_MINUTES'))
    if (minutes > 0) ttlMs = minutes * 60_000
    last = await read($, lastRequestAt)
    thrown = await read($, throwAt)

    $.clock.every(FRAME_MS, async () => {
      if (!site || isBusy) return
      isBusy = true
      try {
        const { requestId, size } = site
        const now = await $.clock.now()
        const cells = draw(size, { now, lastRequestAt: last, ttlMs, throwAt: thrown })
        if (cells === shown) return
        const r = await $.ui.blit({ requestId, key: KEY, cells })
        // Gone or redrawn at another size: wait for the next render
        if ('deny' in r) {
          if (site?.requestId === requestId) site = null
        } else {
          shown = cells
        }
      } catch {
        site = null
      } finally {
        isBusy = false
      }
    })

    await $.command.register({ name: 'fireplace', description: 'Show or hide Clawd\u2019s fireplace above the prompt' })

    return next(e)
  })

  on('command.run', { command: 'fireplace' }, async ($, e) => {
    const wasHidden = await read($, isHidden)
    await update($, isHidden, () => !wasHidden)
    return { text: wasHidden ? 'Fireplace shown.' : 'Fireplace hidden. /fireplace brings it back.' }
  })

  on('prompt.submit', async ($, e, next) => {
    if (isThrow(e.text, e.origin?.kind)) {
      // Not awaited: the animation never holds up a prompt
      $.clock.now()
        .then(now => {
          thrown = now
          return update($, throwAt, () => now)
        })
        .catch(() => {})
    }
    return next(e)
  })

  // Every request of the main loop reads the cache and starts its time over
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) {
      try {
        last = await $.clock.now()
        await update($, lastRequestAt, () => last)
      } catch {}
    }
    return yield* next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const size = sizeFor(e.props.bodyColumns, e.props.maxRows)
    if (e.props.hasSurvey || e.surface !== 'terminal' || size === null || (await read($, isHidden))) {
      if (site?.requestId === e.requestId) site = null
      return next(e)
    }
    site = { requestId: e.requestId, size }

    // What the plugins beneath draw keeps the left of the band; the fireplace takes only its own columns
    const below = await next(e)
    const { Box, Raster } = $.ui.resolve(e)
    const inp: Inputs = {
      now: await $.clock.now(),
      lastRequestAt: await read($, lastRequestAt),
      ttlMs,
      throwAt: await read($, throwAt),
    }
    shown = draw(size, inp)
    const raster = (
      <Raster key={KEY} columns={size === 'full' ? COLUMNS : ROW_COLUMNS} rows={size === 'full' ? ROWS : 1} cells={shown} />
    )
    if (below.type === 'engine') {
      return (
        <Box width={e.props.bodyColumns} justifyContent="flex-end">
          {raster}
        </Box>
      )
    }
    return (
      <Box width={e.props.bodyColumns} flexDirection="row" alignItems="flex-end">
        <Box flexGrow={1} flexShrink={1}>
          {below}
        </Box>
        {raster}
      </Box>
    )
  })
}
