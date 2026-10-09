// The design the mod draws. tools/tuner.html picks one and its Export button copies it here.
import type { Look } from './scene'

export const LOOK: Look = {
  size: 75,
  clawd: 'built-in',
  furnace: 'pot-belly',
  thrown: 'log',
  burning: 'steady',
  cold: 'shiver',
  expired: 'ice',
  bar: { style: 'loud', width: 10, layout: 'stack', title: 'cache', color: 'leitstand' },
}
