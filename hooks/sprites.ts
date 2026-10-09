// Pixel art as strings: one character per pixel, '.' is transparent.
// One terminal cell holds two pixels stacked (▀ with fg on top, bg below).

export const PAL: Record<string, number> = {
  X: 0xd97757, // Clawd
  E: 0x000000, // eyes
  W: 0x8b5a2b, // bark
  w: 0x5e3a1a, // bark, shadow side
  o: 0xd9b77e, // cut end of a log
  K: 0x3b3b42, // iron
  k: 0x26262b, // iron, shadow
  h: 0x5c5c66, // iron, highlight
  r: 0x8a8a95, // rivet
  P: 0x4a4a52, // pipe
  D: 0x140b09, // inside the furnace
  B: 0xc9a227, // brass
}

// Clawd from the front, as in Clawd-Still.png (12 x 8)
export const CLAWD = [
  '..XXXXXXXX..',
  '..XEXXXXEX..',
  'XXXXXXXXXXXX',
  'XXXXXXXXXXXX',
  '..XXXXXXXX..',
  '..XXXXXXXX..',
  '..X.X..X.X..',
  '..X.X..X.X..',
]

// Looking toward the furnace
export const CLAWD_RIGHT = [
  '..XXXXXXXX..',
  '..XXEXXXXE..',
  'XXXXXXXXXXXX',
  'XXXXXXXXXXXX',
  '..XXXXXXXX..',
  '..XXXXXXXX..',
  '..X.X..X.X..',
  '..X.X..X.X..',
]

// Looking at the woodpile
export const CLAWD_LEFT = [
  '..XXXXXXXX..',
  '..EXXXXEXX..',
  'XXXXXXXXXXXX',
  'XXXXXXXXXXXX',
  '..XXXXXXXX..',
  '..XXXXXXXX..',
  '..X.X..X.X..',
  '..X.X..X.X..',
]

// Squatting to pick up a log: one row shorter, legs folded
export const CLAWD_CROUCH = [
  '..XXXXXXXX..',
  '..EXXXXEXX..',
  'XXXXXXXXXXXX',
  'XXXXXXXXXXXX',
  '..XXXXXXXX..',
  '..XXXXXXXX..',
  '.XX.X..X.XX.',
]

// Arms up, holding something overhead (arms start at row 0)
export const CLAWD_UP = [
  'XX........XX',
  'XXXXXXXXXXXX',
  'XXXEXXXXEXXX',
  '..XXXXXXXX..',
  '..XXXXXXXX..',
  '..XXXXXXXX..',
  '..X.X..X.X..',
  '..X.X..X.X..',
]

// Eyes shut, for blinks and for the happy hop
export const CLAWD_BLINK = [
  '..XXXXXXXX..',
  '..XXXXXXXX..',
  'XXXXXXXXXXXX',
  'XXXXXXXXXXXX',
  '..XXXXXXXX..',
  '..XXXXXXXX..',
  '..X.X..X.X..',
  '..X.X..X.X..',
]

// A log seen from the side
export const LOG = [
  'WWWWWo',
  'wwwwwo',
]

// The furnace: a domed iron furnace with an arched mouth (16 x 14)
export const FURNACE = [
  '..........PPP...',
  '..........PPP...',
  '...hhhhhhhhhhh..',
  '..hKKKKKKKKKKKh.',
  '.KKKKKKKKKKKKKKK',
  '.KKKKkDDDDkKKKKK',
  '.KKKDDDDDDDDKKrK',
  '.KKDDDDDDDDDDKKK',
  '.KKDDDDDDDDDDKBK',
  '.KKDDDDDDDDDDKKK',
  '.KKDDDDDDDDDDKrK',
  '.KKKKKKKKKKKKKKK',
  '.hhhhhhhhhhhhhhh',
  '..KK.........KK.',
]

// The box the fire burns in, inside FURNACE; it shows only over 'D'
export const MOUTH = { x: 3, y: 5, w: 10, h: 6 }
// Top of the pipe, where sparks and smoke leave
export const PIPE_TOP = { x: 10, y: 0, w: 3 }
