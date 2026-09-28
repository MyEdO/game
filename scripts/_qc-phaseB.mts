/** QC Phase B — rendu des bipèdes monstrueux via le RIG (auto tête/parts/pelage par espèce).
 *  Une ligne par nom, colonnes face / profil / dos. → public/qc/_qc-phaseB.png */
import { VIEWS } from '../src/gameIso/rig/facing';
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { defsGlobaux } from '../src/gameIso/sprites';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { resolveRig } from '../src/gameIso/rig/composeRig';
import { entityRigProfile } from '../src/gameIso/rig/enemyProfile';
import { hashSeed } from '../src/engine/dice';

// nom → arme à la main (libellé libre)
const NAMES: [string, string][] = [
  ['Orc', 'Épée'],
  ['Gobelin', 'Lance'],
  ['Snotling', 'Gourdin'],
  ['Gor', 'Hache'],
  ['Ungor', 'Gourdin'],
  ['Minotaure', 'Épée'],
  ['Chamane-Brey', 'Bâton'],
  ['Squelette', 'Lance'],
  ['Zombie', ''],
  ['Goule de crypte', ''],
  ['Troll', ''],
  ['Ogre', 'Gourdin'],
  ['Vampire', ''],
  ['Sanguinaire de Khorne', 'Épée'],
];
const CW = 200, CH = 300, SC = 1.8, FEET = 265;
const cells: string[] = [];
NAMES.forEach(([name, weapon], r) => {
  const prof = entityRigProfile(name, hashSeed(name), weapon ? { weapon } : {});
  cells.push(`<text x="6" y="${30 + r * CH + CH / 2}" font-size="11" fill="#d8a93b" font-family="sans-serif">${name}</text>`);
  if (!prof) { cells.push(`<text x="100" y="${30 + r * CH + 40}" font-size="11" fill="#e06a4a">NON-RIG (classifyEnemy=creature !)</text>`); return; }
  VIEWS.forEach((view, i) => {
    const inner = bonesToSvg(resolveRig(prof.appearance, prof.equip, {}, prof.tenue, view));
    const x = 110 + i * CW, y = 30 + r * CH;
    cells.push(`<g transform="translate(${x},${y})"><rect width="${CW - 6}" height="${CH - 10}" fill="#2b3142"/><line x1="0" y1="${FEET}" x2="${CW - 6}" y2="${FEET}" stroke="#e06a4a" stroke-width="0.5" opacity="0.5"/><g transform="translate(${(CW - 6) / 2 - 60 * SC},${FEET - 150 * SC}) scale(${SC})">${inner}</g><text x="${(CW - 6) / 2}" y="${CH - 14}" text-anchor="middle" font-size="10" fill="#cdd" font-family="sans-serif">${view}</text></g>`);
  });
});
const W = 110 + 3 * CW, H = 30 + NAMES.length * CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${defsGlobaux()}</defs><rect width="${W}" height="${H}" fill="#11141c"/><text x="6" y="18" font-size="13" fill="#d8a93b" font-family="sans-serif">QC Phase B — bipèdes monstrueux via le rig (tête/parts/pelage auto par espèce)</text>${cells.join('')}</svg>`;
writeFileSync('public/qc/_qc-phaseB.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W * 2 } }).render().asPng());
console.log('OK _qc-phaseB.png');
