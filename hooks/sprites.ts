// Pixel art as strings: one character per pixel, '.' is transparent.
// One terminal cell holds two pixels stacked (▀ with fg on top, bg below).
// Clawd and the flames follow the cooking scene in Claude Code's own binary (cc-plugin-mods-guide):
// the same 13-wide body, four legs, 1 x 2 eyes and palette. The far-side shade is from Clawd-Basketball.gif.

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
  I: 0x2a2a30, // grate
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
// 17 x 10: arms 2 out at rows 4-5, legs at 2, 4, 12 and 14.
export const CLAWD = {
  stand: [
    '..cCCCCCCCCCCCC..',
    '..cCCCCCCCCCCCC..',
    '..cCCECCCCCCCEC..',
    '..cCCECCCCCCCEC..',
    'cCCCCCCCCCCCCCCCC',
    'cCCCCCCCCCCCCCCCC',
    '..cCCCCCCCCCCCC..',
    '..cCCCCCCCCCCCC..',
    '..c.C.......C.C..',
    '..c.C.......C.C..',
  ],
  // Looking out of the band, the way the welcome banner's Clawd does
  front: [
    '..CCCCCCCCCCCCC..',
    '..CCCCCCCCCCCCC..',
    '..CCECCCCCCCECC..',
    '..CCECCCCCCCECC..',
    'CCCCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCCC',
    '..CCCCCCCCCCCCC..',
    '..CCCCCCCCCCCCC..',
    '..C.C.......C.C..',
    '..C.C.......C.C..',
  ],
  // Reaching down to the woodpile: a pixel lower, knees out, one arm down, eyes squeezed (Basketball frame 4)
  crouch: [
    '.................',
    '..cCCCCCCCCCCCC..',
    '..cCCCCCCCCCCCC..',
    '..cCCCCCCCCCCCC..',
    '..cCEECCCCCCEEC..',
    'cCCCCCCCCCCCCCC..',
    'cCCCCCCCCCCCCCC..',
    '..cCCCCCCCCCCCCCC',
    '..cCCCCCCCCCCCCCC',
    '.c.C.........C.C.',
  ],
  // The throwing arm up, eyes up after the log (19 wide)
  toss: [
    '..cCCCCCCCCCCCC....',
    '..cCCECCCCCCCEC....',
    '..cCCECCCCCCCEC..CC',
    '..cCCCCCCCCCCCC.CC.',
    'cCCCCCCCCCCCCCCCC..',
    'cCCCCCCCCCCCCCC....',
    '..cCCCCCCCCCCCC....',
    '..cCCCCCCCCCCCC....',
    '..c.C.......C.C....',
    '..c.C.......C.C....',
  ],
  // In the air, legs trailing as steps (Clawd-Lurking.gif); drawn a pixel up
  hop: [
    '..cCCCCCCCCCCCC..',
    '..cCCCCCCCCCCCC..',
    '..cCCECCCCCCCEC..',
    '..cCCECCCCCCCEC..',
    'cCCCCCCCCCCCCCCCC',
    'cCCCCCCCCCCCCCCCC',
    '..cCCCCCCCCCCCC..',
    '..cCCCCCCCCCCCC..',
    '..c.C.......C.C..',
    '.c.C.......C.C...',
  ],
}
export type ClawdPose = keyof typeof CLAWD
// The same pose with the eyes shut
export const shut = (art: Art): Art => art.map(l => l.replaceAll('E', 'C'))

// Worn when the fire is low or out, over `stand` and `front`
export const SCARF: Art = [
  '',
  '',
  '',
  '',
  '..bBBBBBBBBBBBB..',
  '..bbbbbbbbbbbBB..',
  '............bB...',
  '............Bb...',
]

// The pile Clawd takes from, and the one log he carries
export const WOODPILE: Art = [
  '.LLLLW',
  '.llllW',
  'LLLLW.',
  'llllW.',
  '.LLLLW',
  '.llllW',
]
export const LOG: Art = ['LLLW', 'lllW']

// A stone fireplace, front on: mantel, arched opening, firebrick, two logs on a grate, hearth (20 x 12)
export const FIREPLACE: Art = [
  'RRRRRRRRRRRRRRRRRRRR',
  'HHHHHHHHHHHHHHHHHHHH',
  '.PPPPPRRRRRRRRPPPPH.',
  '.PPPRRDDDDDDDDRRPPH.',
  '.PPRDDkkDkkkDkkDRPH.',
  '.PRDkkDkkkDkkkDkDRH.',
  '.PRDkkkDkkkDkkkDDRH.',
  '.PRDkDkkkDkkkDkkDRH.',
  '.PRDLLLLLWLLLLLWDRH.',
  '.PRIlllllIlllllIIRH.',
  'RRRRRRRRRRRRRRRRRRRR',
  'HHHHHHHHHHHHHHHHHHHH',
]
// Where the fire sits in FIREPLACE: 12 wide over the logs, its base on row 7
export const BED = { x: 4, y: 7, w: 12 }
// The logs' top row, which glows as embers and turns to ash
export const LOGS_ROW = 8

// The flame tips of the cooking scene, one per frame; under them a checker of F and f
export const TIPS = [
  '..F.y..y.F..', 'y..y.F..F.F.', '.F..F.F..F.y', 'F.F..F.y..y.',
  '.F.y..y.F..F', '..y.F..F.F..', 'F..F.F..F.y.', '.F..F.y..y.F',
  'F.y..y.F..F.', '.y.F..F.F..F', '..F.F..F.y..', 'F..F.y..y.F.',
  '.y..y.F..F.F', 'y.F..F.F..F.', '.F.F..F.y..y', 'y..y.F..F.F.',
]
// Smoke, from the cooking scene's puffs, smallest last
export const PUFFS: Art[] = [['.ss.', 'ssss'], ['ss'], ['s']]
