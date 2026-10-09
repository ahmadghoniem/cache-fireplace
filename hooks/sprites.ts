// Pixel art as strings: one character per pixel, '.' is transparent.
// One terminal cell holds two pixels stacked (▀ with fg on top, bg below).
// Clawd follows the cooking scene in Claude Code's own binary (cc-plugin-mods-guide), scaled down:
// a 9-wide body, four legs, 1 x 2 eyes and the same palette. The far-side shade is from Clawd-Basketball.gif.

export const PAL: Record<string, number> = {
  C: 0xd77757, // Clawd
  c: 0xbe684d, // Clawd, the side turned away
  E: 0x141414, // eyes
  B: 0x4a7fc1, // scarf
  b: 0x2f5d96, // scarf, shade
  R: 0x94a0b0, // stone, lit edge: mantel and hearth
  P: 0x5f6b7a, // stone
  H: 0x465160, // stone, shade
  D: 0x1c1310, // inside the fireplace
  k: 0x33190f, // firebrick
  K: 0x7d8590, // poker
  L: 0x8b5a2b, // bark
  l: 0x5e3a1a, // bark, shade
  W: 0xbe8e5c, // cut end of a log
  a: 0x5b5550, // ash
  F: 0xf59e0b, // flame
  f: 0xef4444, // flame, red
  y: 0xfde047, // flame tip, spark
  s: 0x9aa3ad, // smoke
  G: 0x6b7280, // floor
}

export type Art = string[]
export const artWidth = (art: Art) => Math.max(0, ...art.map(l => l.length))

// Clawd faces the fireplace on his right; the column away from it is a shade darker.
// 12 x 7: body at columns 1-9, eyes at 3 and 8, legs at 1, 3, 7 and 9; columns 10-11 are for reaching.
export const CLAWD = {
  // Arms out both sides, as the mascot stands
  stand: [
    '.cCCCCCCCC..',
    '.cCECCCCEC..',
    '.cCECCCCEC..',
    'cCCCCCCCCCC.',
    '.cCCCCCCCC..',
    '.cCCCCCCCC..',
    '.c.C...C.C..',
  ],
  // Both hands held out to the fire, the far one a row lower and a pixel shorter
  warm: [
    '.cCCCCCCCC..',
    '.cCECCCCEC..',
    '.cCECCCCEC..',
    '.cCCCCCCCCCC',
    '.cCCCCCCCCc.',
    '.cCCCCCCCC..',
    '.c.C...C.C..',
  ],
  // Rubbing his hands: the far arm slides out past the near one and back
  rub: [
    '.cCCCCCCCC..',
    '.cCECCCCEC..',
    '.cCECCCCEC..',
    '.cCCCCCCCCC.',
    '.cCCCCCCCCcc',
    '.cCCCCCCCC..',
    '.c.C...C.C..',
  ],
  // Looking out of the band, the way the welcome banner's Clawd does
  front: [
    '.CCCCCCCCC..',
    '.CECCCCCEC..',
    '.CECCCCCEC..',
    'CCCCCCCCCCC.',
    '.CCCCCCCCC..',
    '.CCCCCCCCC..',
    '.C.C...C.C..',
  ],
  // Mid-step: the legs in pairs
  step: [
    '.cCCCCCCCC..',
    '.cCECCCCEC..',
    '.cCECCCCEC..',
    'cCCCCCCCCCC.',
    '.cCCCCCCCC..',
    '.cCCCCCCCC..',
    '..cC...CC...',
  ],
  // Reaching down to the woodpile: a pixel lower, eyes squeezed, knees out (Basketball frame 4)
  crouch: [
    '............',
    '.cCCCCCCCC..',
    '.cCECCCCEC..',
    '.cCCCCCCCC..',
    'ccCCCCCCCC..',
    '.cCCCCCCCCCC',
    'c.C.....C.C.',
  ],
  // The near arm up and out, throwing
  toss: [
    '.cCCCCCCCC..',
    '.cCECCCCEC.C',
    '.cCECCCCECC.',
    'cCCCCCCCCC..',
    '.cCCCCCCCC..',
    '.cCCCCCCCC..',
    '.c.C...C.C..',
  ],
  // Holding the poker out level
  poke: [
    '.cCCCCCCCC..',
    '.cCECCCCEC..',
    '.cCECCCCEC..',
    'cCCCCCCCCCCC',
    '.cCCCCCCCC..',
    '.cCCCCCCCC..',
    '.c.C...C.C..',
  ],
}
export type ClawdPose = keyof typeof CLAWD
// The same pose with the eyes shut
export const shut = (art: Art): Art => art.map(l => l.replaceAll('E', 'C'))
// Facing away from the fireplace: mirrored, so the shade moves to the other side
export const turned = (art: Art): Art => {
  const w = artWidth(art)
  return art.map(l => [...l.padEnd(w, '.')].reverse().join(''))
}

// Worn from 20 minutes left, over any idle pose: wrapped at the arm line, a tail hanging behind
export const SCARF: Art = [
  '',
  '',
  '',
  '.bBBBBBBBB',
  '..Bb',
  '..bB',
]

// The pile Clawd takes from, and the one log he carries
export const WOODPILE: Art = [
  '.LLLW',
  'LLLLW',
  'llllW',
]
export const LOG: Art = ['LLW', 'llW']

// A stone fireplace, front on: mantel, opening, firebrick, logs on the grate, hearth (14 x 8)
export const FIREPLACE: Art = [
  'RRRRRRRRRRRRRR',
  '.HHHHHHHHHHHH.',
  '.PPRRRRRRRRPH.',
  '.PRDkkDkkDkRH.',
  '.PRkDkkDkkDRH.',
  '.PRDkDkkDkkRH.',
  '.PRLLWlLLLWRH.',
  'RRRRRRRRRRRRRR',
]
// Where the fire sits in FIREPLACE: 8 wide over the logs, its base on row 5
export const BED = { x: 3, y: 5, w: 8 }
// The logs' row, which glows as embers and turns to ash
export const LOGS_ROW = 6
// The hearth, which takes the fire's glow
export const HEARTH_ROW = 7

// The flame tips of the cooking scene, one per frame; under them a checker of F and f
export const TIPS = [
  '..F.y..y', 'y..y.F..', '.F..F.F.', 'F.F..F.y',
  '.F.y..y.', '..y.F..F', 'F..F.F..', '.F..F.y.',
  'F.y..y.F', '.y.F..F.', '..F.F..F', 'F..F.y..',
  '.y..y.F.', 'y.F..F.F', '.F.F..F.', 'y..y.F..',
]
// Smoke, from the cooking scene's puffs, smallest last
export const PUFFS: Art[] = [['.s.', 'sss'], ['ss'], ['s']]
