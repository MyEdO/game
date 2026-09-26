import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { defsGlobaux } from '../src/gameIso/sprites';
import { weaponPart, objetSansPorteur } from '../src/gameIso/rig/parts/equipment';
import { pickView } from '../src/gameIso/rig/parts/types';
import type { Weapon } from '../src/engine/types';

const wep = (name: string): Weapon => ({ label: name, type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] } as Weapon);
const W: [string, string][] = [
  ['epee', 'Épée'], ['hache', 'Hache'], ['masse', 'Masse'], ['dague', 'Dague'], ['lance', 'Lance'],
  ['baton', 'Bâton de combat'], ['arc', 'Arc long'], ['arbalete', 'Arbalète'], ['poudre', 'Pistolet'],
  ['fronde', 'Fronde'], ['fouet', 'Fouet'], ['explosif', 'Bombe'], ['parade', 'Main Gauche'],
];
const CW = 90, CH = 110, COLS = 5;
const cells = W.map(([fam, name], i) => {
  const frag = pickView(objetSansPorteur(weaponPart(wep(name))), 'front');
  const x = (i % COLS) * CW, y = Math.floor(i / COLS) * CH;
  // place weapon frame (-20..20 x, -56..16 y) into cell, centered, scaled ~1.4
  return `<g transform="translate(${x + CW / 2},${y + 70})"><rect x="${-CW / 2}" y="-70" width="${CW}" height="${CH}" fill="${i % 2 ? '#20262f' : '#262d38'}"/><g transform="scale(1.5)">${frag}</g><text x="0" y="34" fill="#9fb" font-size="9" text-anchor="middle">${fam}</text></g>`;
});
const W2 = COLS * CW, H2 = Math.ceil(W.length / COLS) * CH;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W2} ${H2}"><defs>${defsGlobaux()}</defs><rect width="${W2}" height="${H2}" fill="#1a1f28"/>${cells.join('')}</svg>`;
const r = new Resvg(svg, { background: '#1a1f28', fitTo: { mode: 'width', value: W2 * 2 } });
writeFileSync('public/qc/weapons-montage.png', r.render().asPng());
console.log('OK: public/qc/weapons-montage.png');
