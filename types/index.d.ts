// A moment in ms since the epoch, or null before the first one
export type Moment = number | null

declare module 'claude-code' {
  interface PluginState {
    'cache-fireplace': {
      // When the main loop last sent a request: the cache was written or read then
      lastRequestAt: Moment
      // When the person last sent a prompt to a cold cache: Clawd throws a log on
      throwAt: Moment
      // When the person last sent a prompt to a warm cache: Clawd pokes the fire
      pokeAt: Moment
      isHidden: boolean
    }
  }
}
