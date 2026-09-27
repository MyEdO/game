/**
 * Montage isolé d'une liste de slugs d'arme (art RÉSOLU via weaponPart) pour revue à l'œil.
 * Usage : npx tsx scripts/_qc-redo-montage.mts <slug1> <slug2> ...  → public/qc/redo-montage.png
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { defsGlobaux } from '../src/gameIso/sprites';
import { weaponPart, objetSansPorteur } from '../src/gameIso/rig/parts/equipment';
import { pickView } from '../src/gameIso/rig/parts/types';
import { WEAPON_FORMS } from '../src/gameIso/rig/parts/weaponForms';
import type { Weapon } from '../src/engine/types';

const slugs = process.argv.slice(2);
const bySlug = new Map(WEAPON_FORMS.map((f) => [f.slug, f]));
mkdirSync('public/qc', { recursive: true });

const CW = 90, CH = 120;
const tiles = slugs.map((slug, i) => {
  const f = bySlug.get(slug);
  if (!f) return '';
  const art = weaponPart({ label: f.label, type: f.type, damage: { plusBF: false, flat: 4 }, qualities: [] } as Weapon);
  const svg = pickView(objetSansPorteur(art), 'front');
  return `<g transform="translate(${i * CW},0)"><rect width="${CW}" height="${CH}" fill="#222831"/>` +
    `<g transform="translate(${CW / 2},${CH - 26})">${svg}</g>` +
    `<text x="${CW / 2}" y="${CH - 6}" text-anchor="middle" font-size="8" fill="#cdd">${f.label}</text></g>`;
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${slugs.length * CW} ${CH}"><defs>${defsGlobaux()}</defs>${tiles.join('')}</svg>`;
writeFileSync('public/qc/redo-montage.png', new Resvg(svg, { background: '#222831', fitTo: { mode: 'width', value: slugs.length * CW * 3 } }).render().asPng());
console.log(`OK → public/qc/redo-montage.png (${slugs.length})`);
