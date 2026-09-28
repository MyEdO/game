/** QC Phase B FOCUS — rend un sous-ensemble de noms à grande échelle pour inspection fine.
 *  Usage : npx tsx scripts/_qc-phaseB-focus.mts <groupe>  (groupe ∈ vert|bete|mv|gros) */
import { VIEWS } from '../src/gameIso/rig/facing';
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { defsGlobaux } from '../src/gameIso/sprites';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { resolveRig } from '../src/gameIso/rig/composeRig';
import { entityRigProfile } from '../src/gameIso/rig/enemyProfile';
import { hashSeed } from '../src/engine/dice';

const GROUPS: Record<string, [string, string][]> = {
  vert: [['Orc', 'Épée'], ['Gobelin', 'Lance'], ['Snotling', 'Gourdin']],
  bete: [['Gor', 'Hache'], ['Ungor', 'Gourdin'], ['Minotaure', 'Épée'], ['Chamane-Brey', 'Bâton']],
  mv: [['Squelette', 'Lance'], ['Zombie', ''], ['Goule de crypte', '']],
  gros: [['Troll', ''], ['Ogre', 'Gourdin'], ['Vampire', ''], ['Sanguinaire de Khorne', 'Épée']],
};
const group = process.argv[2] || 'vert';
const NAMES = GROUPS[group];
const CW = 280, CH = 420, SC = 2.5, FEET = 375;
const cells: string[] = [];
NAMES.forEach(([name, weapon], r) => {
  const prof = entityRigProfile(name, hashSeed(name), weapon ? { weapon } : {});
  cells.push(`<text x="6" y="${30 + r * CH + CH / 2}" font-size="13" fill="#d8a93b" font-family="sans-serif">${name}</text>`);
  if (!prof) { cells.push(`<text x="120" y="${30 + r * CH + 40}" font-size="12" fill="#e06a4a">NON-RIG !</text>`); return; }
  VIEWS.forEach((view, i) => {
    const inner = bonesToSvg(resolveRig(prof.appearance, prof.equip, {}, prof.tenue, view));
    const x = 120 + i * CW, y = 30 + r * CH;
    cells.push(`<g transform="translate(${x},${y})"><rect width="${CW - 6}" height="${CH - 10}" fill="#2b3142"/><line x1="0" y1="${FEET}" x2="${CW - 6}" y2="${FEET}" stroke="#e06a4a" stroke-width="0.5" opacity="0.5"/><g transform="translate(${(CW - 6) / 2 - 60 * SC},${FEET - 150 * SC}) scale(${SC})">${inner}</g><text x="${(CW - 6) / 2}" y="${CH - 14}" text-anchor="middle" font-size="11" fill="#cdd" font-family="sans-serif">${view}</text></g>`);
  });
});
const W = 120 + 3 * CW, H = 30 + NAMES.length * CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${defsGlobaux()}</defs><rect width="${W}" height="${H}" fill="#11141c"/><text x="6" y="18" font-size="14" fill="#d8a93b" font-family="sans-serif">QC Phase B — ${group}</text>${cells.join('')}</svg>`;
writeFileSync(`public/qc/_qc-pB-${group}.png`, new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W } }).render().asPng());
console.log(`OK _qc-pB-${group}.png`);
