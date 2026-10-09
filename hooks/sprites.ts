// Pixel art as strings: one character per pixel, '.' is transparent.
// One terminal cell holds two pixels stacked (▀ with fg on top, bg below).
// Each object has named designs; the tuner offers every name, LOOK picks one.

export const PAL: Record<string, number> = {
  X: 0xd97757, // Clawd
  x: 0xa8523a, // Clawd, shut eyes and folded arms
  E: 0x000000, // eyes
  W: 0x8b5a2b, // bark
  w: 0x5e3a1a, // bark, shadow side
  o: 0xd9b77e, // cut end of a log
  K: 0x3b3b42, // iron
  k: 0x26262b, // iron, shadow
  h: 0x5c5c66, // iron, highlight
  r: 0x8a8a95, // rivet
  P: 0x4a4a52, // pipe
  D: 0x140b09, // inside the furnace: the fire draws over it
  B: 0xc9a227, // brass
  c: 0x1d1d22, // coal
  g: 0x6a6a78, // coal, shine
  p: 0xeeeae0, // paper
  q: 0x9a958c, // paper, ruled line
  S: 0x4a7fc1, // scarf
  s: 0x2f5d96, // scarf, shade
}

export type Art = string[]
export const artWidth = (art: Art) => Math.max(0, ...art.map(l => l.length))

// Clawd's poses: 12 x 8 except where noted
export type ClawdPose = 'front' | 'right' | 'left' | 'blink' | 'crouch' | 'up' | 'warm' | 'hug' | 'sleep'
export type ClawdArt = Record<ClawdPose, Art>
// The firebox is every 'D' pixel inside `mouth`; sparks and smoke leave from `pipe`
export type FurnaceArt = { art: Art; mouth: { x: number; y: number; w: number; h: number }; pipe: { x: number; w: number } }
// What Clawd throws: one piece in the hands, and the pile it comes from
export type ThrownArt = { held: Art; pile: Art }

export const CLAWDS: Record<string, ClawdArt> = {
  // From Clawd-Still.png and the mascot GIFs
  'built-in': {
    front: [
      '..XXXXXXXX..',
      '..XEXXXXEX..',
      'XXXXXXXXXXXX',
      'XXXXXXXXXXXX',
      '..XXXXXXXX..',
      '..XXXXXXXX..',
      '..X.X..X.X..',
      '..X.X..X.X..',
    ],
    // Looking toward the furnace
    right: [
      '..XXXXXXXX..',
      '..XXEXXXXE..',
      'XXXXXXXXXXXX',
      'XXXXXXXXXXXX',
      '..XXXXXXXX..',
      '..XXXXXXXX..',
      '..X.X..X.X..',
      '..X.X..X.X..',
    ],
    // Looking at the pile
    left: [
      '..XXXXXXXX..',
      '..EXXXXEXX..',
      'XXXXXXXXXXXX',
      'XXXXXXXXXXXX',
      '..XXXXXXXX..',
      '..XXXXXXXX..',
      '..X.X..X.X..',
      '..X.X..X.X..',
    ],
    blink: [
      '..XXXXXXXX..',
      '..XXXXXXXX..',
      'XXXXXXXXXXXX',
      'XXXXXXXXXXXX',
      '..XXXXXXXX..',
      '..XXXXXXXX..',
      '..X.X..X.X..',
      '..X.X..X.X..',
    ],
    // Squatting to pick something up: 7 tall
    crouch: [
      '..XXXXXXXX..',
      '..EXXXXEXX..',
      'XXXXXXXXXXXX',
      'XXXXXXXXXXXX',
      '..XXXXXXXX..',
      '..XXXXXXXX..',
      '.XX.X..X.XX.',
    ],
    // Arms up, holding something overhead
    up: [
      'XX........XX',
      'XXXXXXXXXXXX',
      'XXXEXXXXEXXX',
      '..XXXXXXXX..',
      '..XXXXXXXX..',
      '..XXXXXXXX..',
      '..X.X..X.X..',
      '..X.X..X.X..',
    ],
    // Both arms reaching toward the furnace: 13 wide
    warm: [
      '..XXXXXXXX...',
      '..XXEXXXXE...',
      '..XXXXXXXXXXX',
      '..XXXXXXXXXXX',
      '..XXXXXXXX...',
      '..XXXXXXXX...',
      '..X.X..X.X...',
      '..X.X..X.X...',
    ],
    // Arms folded in against the cold
    hug: [
      '..XXXXXXXX..',
      '..XEXXXXEX..',
      '..XXXXXXXX..',
      '.XxxxxxxxxX.',
      '..XXXXXXXX..',
      '..XXXXXXXX..',
      '..X.X..X.X..',
      '..X.X..X.X..',
    ],
    // Sitting, eyes shut: 7 tall
    sleep: [
      '..XXXXXXXX..',
      '..xxXXXXxx..',
      'XXXXXXXXXXXX',
      'XXXXXXXXXXXX',
      '..XXXXXXXX..',
      '..XXXXXXXX..',
      '.XX.X..X.XX.',
    ],
  },
}

// Worn over a standing pose
export const SCARF: Art = [
  '............',
  '............',
  '..SSSSSSSS..',
  '...s........',
  '...S........',
  '...s........',
]

export const FURNACES: Record<string, FurnaceArt> = {
  // A small pot-belly furnace with an arched mouth (12 x 10)
  'pot-belly': {
    art: [
      '.......PP...',
      '..hhhhhPPh..',
      '.hKKKKKKKKKh',
      '.KKkDDDDkKKK',
      '.KKDDDDDDKrK',
      '.KKDDDDDDKBK',
      '.KKDDDDDDKKK',
      '.KKKKKKKKKKK',
      '.hhhhhhhhhhh',
      '..KK.....KK.',
    ],
    mouth: { x: 3, y: 3, w: 6, h: 4 },
    pipe: { x: 7, w: 2 },
  },
  // A square box stove, wider mouth, pipe straight up (12 x 10)
  'box stove': {
    art: [
      '........PP..',
      '........PP..',
      '.hhhhhhhPPh.',
      '.KKKKKKKKKKK',
      '.KkDDDDDDkKK',
      '.KDDDDDDDDBK',
      '.KDDDDDDDDKK',
      '.KkkkkkkkkKK',
      '.hhhhhhhhhhh',
      '.KK......KK.',
    ],
    mouth: { x: 2, y: 4, w: 8, h: 3 },
    pipe: { x: 8, w: 2 },
  },
}

export const THROWN: Record<string, ThrownArt> = {
  log: {
    held: ['WWWo', 'wwwo'],
    pile: [
      'WWWo.',
      'wwwo.',
      '.WWWo',
      '.wwwo',
      'WWWo.',
      'wwwo.',
    ],
  },
  coal: {
    held: ['gc', 'cc'],
    // A scuttle heaped with coal
    pile: [
      '.cgc.',
      'cgccg',
      'KKKKK',
      'hKKKh',
      '.KKK.',
    ],
  },
  // Pages of the prompt
  page: {
    held: ['pqp', 'ppp'],
    pile: [
      '.ppp.',
      'pqqqp',
      'ppppp',
      'qqqqq',
    ],
  },
}
