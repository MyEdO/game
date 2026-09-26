/**
 * Compare le rendu d'armes via weaponPart (art RÉSOLU) — sert avant (original, no-op) et après
 * (tokenisé @défaut) la tokenisation, pour vérifier la LOSSLESSNESS.
 * Usage : npx tsx scripts/_qc-weapon-color-cmp.mts <tag>   → public/qc/wcolor-<tag>.png
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { defsGlobaux } from '../src/gameIso/sprites';
import { weaponPart, objetSansPorteur } from '../src/gameIso/rig/parts/equipment';
import type { Weapon } from '../src/engine/types';

const tag = process.argv[2] ?? 'x';
const skin: Record<string, string> | undefined = process.argv[3] ? JSON.parse(process.argv[3]) : undefined;
const W = (name: string, type: 'melee' | 'ranged' = 'melee'): Weapon => ({ label: name, type, damage: { plusBF: false, flat: 4 }, qualities: [], skin } as Weapon);
const NAMES: Array<[string, 'melee' | 'ranged']> = [
  ['Épée bâtarde', 'melee'], ['Hallebarde', 'melee'], ['Zweihänder', 'melee'], ['Fléau d\'armes', 'melee'],
  ['Dague', 'melee'], ['Arc long', 'ranged'], ['Arbalète', 'ranged'], ['Arquebuse', 'ranged'],
  ['Pistolet', 'ranged'], ['Bombe', 'ranged'],
];

mkdirSync('public/qc', { recursive: true });
const CW = 80, CH = 120;
const tiles = NAMES.map(([name, type], i) => {
  const art = objetSansPorteur(weaponPart(W(name, type)));
  const svg = typeof art === 'string' ? art : (art.front ?? '');
  return `<g transform="translate(${i * CW},0)"><rect width="${CW}" height="${CH}" fill="#1d2230"/>` +
    `<g transform="translate(${CW / 2},${CH - 22})">${svg}</g>` +
    `<text x="${CW / 2}" y="${CH - 4}" text-anchor="middle" font-size="6.5" fill="#cdd">${name}</text></g>`;
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${NAMES.length * CW} ${CH}"><defs>${defsGlobaux()}</defs>${tiles.join('')}</svg>`;
writeFileSync(`public/qc/wcolor-${tag}.png`, new Resvg(svg, { background: '#11141c', fitTo: { mode: 'width', value: NAMES.length * CW * 3 } }).render().asPng());
console.log(`OK → public/qc/wcolor-${tag}.png`);
