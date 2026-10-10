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
  L: 0x8b5a2b, // bark
  l: 0x5e3a1a, // bark, shade
  W: 0xbe8e5c, // cut end of a log
  a: 0x5b5550, // ash
  F: 0xf59e0b, // flame
  f: 0xef4444, // flame, red
  y: 0xfde047, // flame tip, spark
  s: 0x9aa3ad, // smoke
  G: 0x6b7280, // floor
  Z: 0x212732, // floor in the side wall's shadow
  T: 0xb9c2cc, // stone, top face
  S: 0x39434f, // stone, top of the side wall
  V: 0x1d252f, // stone, side wall
  M: 0x2e3744, // stone, side of the mantel
  w: 0x5a2a1c, // inner left wall of the opening
}

export type Art = string[]
export const artWidth = (art: Art) => Math.max(0, ...art.map(l => l.length))

// Clawd faces the fireplace on his right; the column away from it is a shade darker.
// 18 x 9, the mascot's own size with one row of legs: body at columns 2-14, eyes at 5 and 13,
// arms on rows 4-5, legs at 2, 4, 12 and 14; columns 15-17 are for reaching.
export const CLAWD = {
  // Arms out both sides, as the mascot stands
  stand: [
    '..cCCCCCCCCCCCC...',
    '..cCCCCCCCCCCCC...',
    '..cCCECCCCCCCEC...',
    '..cCCECCCCCCCEC...',
    'cCCCCCCCCCCCCCCCC.',
    'cCCCCCCCCCCCCCCCC.',
    '..cCCCCCCCCCCCC...',
    '..cCCCCCCCCCCCC...',
    '..c.C.......C.C...',
  ],
  // Both hands held out to the fire, the far one a row lower and shorter
  warm: [
    '..cCCCCCCCCCCCC...',
    '..cCCCCCCCCCCCC...',
    '..cCCECCCCCCCEC...',
    '..cCCECCCCCCCEC...',
    '..cCCCCCCCCCCCCCCC',
    '..cCCCCCCCCCCCCCCC',
    '..cCCCCCCCCCCCCcc.',
    '..cCCCCCCCCCCCC...',
    '..c.C.......C.C...',
  ],
  // Rubbing his hands: the far arm slides out past the near one and back
  rub: [
    '..cCCCCCCCCCCCC...',
    '..cCCCCCCCCCCCC...',
    '..cCCECCCCCCCEC...',
    '..cCCECCCCCCCEC...',
    '..cCCCCCCCCCCCCCC.',
    '..cCCCCCCCCCCCCCC.',
    '..cCCCCCCCCCCCCccc',
    '..cCCCCCCCCCCCC...',
    '..c.C.......C.C...',
  ],
  // Looking out of the band, the way the welcome banner's Clawd does
  front: [
    '..CCCCCCCCCCCCC...',
    '..CCCCCCCCCCCCC...',
    '..CCCECCCCCCCEC...',
    '..CCCECCCCCCCEC...',
    'CCCCCCCCCCCCCCCCC.',
    'CCCCCCCCCCCCCCCCC.',
    '..CCCCCCCCCCCCC...',
    '..CCCCCCCCCCCCC...',
    '..C.C.......C.C...',
  ],
  // Mid-step: the legs in pairs
  step: [
    '..cCCCCCCCCCCCC...',
    '..cCCCCCCCCCCCC...',
    '..cCCECCCCCCCEC...',
    '..cCCECCCCCCCEC...',
    'cCCCCCCCCCCCCCCCC.',
    'cCCCCCCCCCCCCCCCC.',
    '..cCCCCCCCCCCCC...',
    '..cCCCCCCCCCCCC...',
    '...cC.......CC....',
  ],
  // Reaching down for a log: squashed a row from the top, eyes squeezed, the near arm a row lower
  // (Basketball frames 4 and 14)
  crouch: [
    '..................',
    '..cCCCCCCCCCCCC...',
    '..cCCCCCCCCCCCC...',
    '..cCCECCCCCCCEC...',
    'cCCCCCCCCCCCCCC...',
    'cCCCCCCCCCCCCCC...',
    '..cCCCCCCCCCCCCCC.',
    '..cCCCCCCCCCCCC...',
    '..c.C.......C.C...',
  ],
  // Holding the log against his side, the near arm behind it (Basketball frame 6)
  lift: [
    '..cCCCCCCCCCCCC...',
    '..cCCCCCCCCCCCC...',
    '..cCCECCCCCCCEC...',
    '..cCCECCCCCCCEC...',
    'cCCCCCCCCCCCCCC...',
    'cCCCCCCCCCCCCCC...',
    '..cCCCCCCCCCCCC...',
    '..cCCCCCCCCCCCC...',
    '..c.C.......C.C...',
  ],
  // The near arm up over the log, throwing (Basketball frame 17)
  toss: [
    '..cCCCCCCCCCCCC...',
    '..cCCCCCCCCCCCC...',
    '..cCCECCCCCCCECCC.',
    '..cCCECCCCCCCEC...',
    'cCCCCCCCCCCCCCC...',
    'cCCCCCCCCCCCCCC...',
    '..cCCCCCCCCCCCC...',
    '..cCCCCCCCCCCCC...',
    '..c.C.......C.C...',
  ],
  // Holding the poker out level
  poke: [
    '..cCCCCCCCCCCCC...',
    '..cCCCCCCCCCCCC...',
    '..cCCECCCCCCCEC...',
    '..cCCECCCCCCCEC...',
    'cCCCCCCCCCCCCCCCCC',
    'cCCCCCCCCCCCCCCCCC',
    '..cCCCCCCCCCCCC...',
    '..cCCCCCCCCCCCC...',
    '..c.C.......C.C...',
  ],
}
export type ClawdPose = keyof typeof CLAWD
// The same pose with the eyes shut
export const shut = (art: Art): Art => art.map(l => l.replaceAll('E', 'C'))
// Facing away from the fireplace: mirrored, the shade with it on the side he turns away from
export const turned = (art: Art): Art => {
  const w = artWidth(art)
  return art.map(l => [...l.padEnd(w, '.')].reverse().join(''))
}

// Worn from 20 minutes left, over any idle pose: wrapped at the arm line, a tail hanging behind
export const SCARF: Art = [
  '',
  '',
  '',
  '',
  '..bBBBBBBBBBBBB',
  '..bbbbbbbbbbbBB',
  '..Bb',
  '..bB',
]

// The one log Clawd carries
export const LOG: Art = ['LLW', 'llW']

// A stone fireplace turned to face Clawd (16 x 9): a pale top T, the mantel's front R, the front
// stone P, and on the right the side wall seen edge-on (S over V, M beside the mantel). The opening
// has a frame H on its left only; its inner left wall w shows, firebrick behind, logs on its floor.
// It stands on the floor, which is in its shadow (Z) under the side wall.
export const FIREPLACE: Art = [
  'TTTTTTTTTTTTTTSS',
  'RRRRRRRRRRRRRRMM',
  'PPPPPPPPPPPPPPVV',
  'PPHwwDkkDkkDPPVV',
  'PPHwwkDkkDkkPPVV',
  'PPHwwDkkDkkDPPVV',
  'PPHwwkkDkkDkPPVV',
  'PPHwLLWlLLLWPPVV',
  'PPPPPPPPPPPPPPVV',
]
// Where the fire sits in FIREPLACE: 8 wide over the logs, its base on row 6
export const BED = { x: 4, y: 6, w: 8 }
// The logs' row, which glows as embers and turns to ash
export const LOGS_ROW = 7
// The side wall's columns: the floor under them is in shadow
export const SIDE_W = 2

// The flame tips of the cooking scene, one per frame; under them a checker of F and f
export const TIPS = [
  '..F.y..y', 'y..y.F..', '.F..F.F.', 'F.F..F.y',
  '.F.y..y.', '..y.F..F', 'F..F.F..', '.F..F.y.',
  'F.y..y.F', '.y.F..F.', '..F.F..F', 'F..F.y..',
  '.y..y.F.', 'y.F..F.F', '.F.F..F.', 'y..y.F..',
]
// Smoke, from the cooking scene's puffs, smallest last
export const PUFFS: Art[] = [['.s.', 'sss'], ['ss'], ['s']]
