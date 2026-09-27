/** QC AVEUGLE — planche de bipèdes monstrueux SANS étiquette de nom (seulement un n° de case).
 *  Les agents-vision identifient chaque case à l'aveugle ; on score vs la vérité (écrite à part,
 *  que les agents ne voient pas). → public/qc/_blind-sheet.png + public/qc/_blind-truth.json */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { defsGlobaux } from '../src/gameIso/sprites';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { resolveRig } from '../src/gameIso/rig/composeRig';
import { entityRigProfile } from '../src/gameIso/rig/enemyProfile';
import { hashSeed } from '../src/engine/dice';
import type { View } from '../src/gameIso/rig/facing';

// [nom interne (vérité), arme]. L'ordre est mélangé pour ne pas suggérer un regroupement.
const TRUTH: [string, string][] = [
  ['Squelette', 'Lance'],
  ['Orc', 'Épée'],
  ['Troll', ''],
  ['Gobelin', 'Lance'],
  ['Sanguinaire de Khorne', 'Épée'],
  ['Goule de crypte', ''],
  ['Minotaure', 'Hache'],
  ['Snotling', 'Gourdin'],
  ['Vampire', ''],
  ['Zombie', ''],
  ['Ogre', 'Gourdin'],
  ['Gor', 'Hache'],
  ['Skaven', 'Dague'],
];
// Pour chaque case : face + profil côte à côte (aide l'identification 3D).
const SHOWN_VIEWS: View[] = ['front', 'profile'];
const COLS = 4;
const CW = 300, CH = 340, SC = 1.95, FEET = 285, SUB = CW / 2;
const cells: string[] = [];
TRUTH.forEach(([name, weapon], idx) => {
  const col = idx % COLS, row = Math.floor(idx / COLS);
  const ox = 10 + col * CW, oy = 36 + row * CH;
  const prof = entityRigProfile(name, hashSeed(name + idx), weapon ? { weapon } : {});
  cells.push(`<rect x="${ox}" y="${oy}" width="${CW - 8}" height="${CH - 10}" fill="#2b3142" stroke="#3a4156"/>`);
  cells.push(`<text x="${ox + 8}" y="${oy + 18}" font-size="15" fill="#e8c25a" font-family="sans-serif" font-weight="bold">#${idx + 1}</text>`);
  if (!prof) { cells.push(`<text x="${ox + 40}" y="${oy + 60}" font-size="12" fill="#e06a4a">NON-RIG</text>`); return; }
  SHOWN_VIEWS.forEach((view, i) => {
    const inner = bonesToSvg(resolveRig(prof.appearance, prof.equip, {}, prof.tenue, view));
    const sx = ox + i * SUB + SUB / 2;
    cells.push(`<g transform="translate(${sx - 60 * SC},${oy + FEET - 150 * SC}) scale(${SC})">${inner}</g>`);
  });
});
const W = 10 + COLS * CW, H = 36 + Math.ceil(TRUTH.length / COLS) * CH + 10;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${defsGlobaux()}</defs><rect width="${W}" height="${H}" fill="#171b24"/><text x="10" y="22" font-size="15" fill="#9fb0c8" font-family="sans-serif">Identifie chaque creature (face + profil par case)</text>${cells.join('')}</svg>`;
writeFileSync('public/qc/_blind-sheet.png', new Resvg(full, { background: '#171b24', fitTo: { mode: 'width', value: W * 2 } }).render().asPng());
writeFileSync('public/qc/_blind-truth.json', JSON.stringify(TRUTH.map(([n], i) => ({ cell: i + 1, truth: n })), null, 2));
console.log('OK _blind-sheet.png (' + TRUTH.length + ' cases)');
