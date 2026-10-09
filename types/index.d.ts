// A moment in ms since the epoch, or null before the first one
export type Moment = number | null

declare module 'claude-code' {
  interface PluginState {
    'clawd-furnace': {
      // When the main loop last sent a request: the cache was written or read then
      lastRequestAt: Moment
      // When the person last sent a prompt: Clawd throws a log
      throwAt: Moment
      isHidden: boolean
    }
  }
}
