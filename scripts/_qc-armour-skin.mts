/**
 * QC skin d'armure : les 4 matériaux (torse) en DÉFAUT (sans perte) + un SKIN (or, pourpre)
 * via armourPart résolu. → public/qc/armour-skin.png. Usage : npx tsx scripts/_qc-armour-skin.mts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { defsGlobaux } from '../src/gameIso/sprites';
import { armourPart, objetSansPorteur } from '../src/gameIso/rig/parts/equipment';
import { pickView } from '../src/gameIso/rig/parts/types';
import type { ItemInstance } from '../src/engine/types';

const MATS: Array<[label: string, name: string]> = [
  ['Rembourré', 'Gambison'], ['Cuir', 'Armure de cuir'], ['Maille', 'Cotte de mailles'], ['Plaque', 'Plastron de plaques'],
];
const SKINS: Array<[tag: string, skin?: Record<string, string>]> = [
  ['défaut', undefined],
  ['or', { metal: '#caa64a', cuir: '#7a5a18' }],
  ['pourpre', { metal: '#6a3a6a', cuir: '#3a2440' }],
];

const it = (name: string, skin?: Record<string, string>): ItemInstance =>
  ({ uid: 'a', label: name, kind: 'armor', qualities: [], enc: 1, equipped: true, pa: 3, locs: ['corps'], skin } as ItemInstance);

mkdirSync('public/qc', { recursive: true });
const CW = 70, CH = 96, COLS = MATS.length;
const tiles: string[] = [];
SKINS.forEach(([tag, skin], row) => {
  MATS.forEach(([lbl, name], col) => {
    const p = armourPart(it(name, skin), 'torse');
    const art = p ? pickView(objetSansPorteur(p), 'front') : '';
    const x = col * CW, y = row * CH;
    tiles.push(`<g transform="translate(${x},${y})"><rect width="${CW}" height="${CH}" fill="#1d2230"/><g transform="translate(${CW / 2},${CH / 2 + 4})">${art}</g><text x="${CW / 2}" y="${CH - 4}" text-anchor="middle" font-size="7" fill="#cdd">${lbl} · ${tag}</text></g>`);
  });
});
const W = COLS * CW, H = SKINS.length * CH;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${defsGlobaux()}</defs>${tiles.join('')}</svg>`;
writeFileSync('public/qc/armour-skin.png', new Resvg(svg, { background: '#11141c', fitTo: { mode: 'width', value: W * 3 } }).render().asPng());
console.log('OK → public/qc/armour-skin.png');
