/** QC des nouveaux bipèdes sortis du monolithique : Liche, Démonette, Fimir. */
import { VIEWS } from '../src/gameIso/rig/facing';
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { defsGlobaux } from '../src/gameIso/sprites';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { resolveRig } from '../src/gameIso/rig/composeRig';
import { entityRigProfile } from '../src/gameIso/rig/enemyProfile';
import { hashSeed } from '../src/engine/dice';

const NAMES: [string, string][] = [['Liche', ''], ['Démonette de Slaanesh', ''], ['Fimir', 'Gourdin']];
const CW = 300, CH = 340, SC = 1.9, FEET = 285;
const cells: string[] = [];
NAMES.forEach(([name, weapon], r) => {
  const prof = entityRigProfile(name, hashSeed(name), weapon ? { weapon } : {});
  cells.push(`<text x="6" y="${30 + r * CH + CH / 2}" font-size="14" fill="#d8a93b" font-family="sans-serif">${name}</text>`);
  if (!prof) { cells.push(`<text x="120" y="${30 + r * CH + 40}" font-size="12" fill="#e06a4a">NON-RIG</text>`); return; }
  VIEWS.forEach((view, i) => {
    const inner = bonesToSvg(resolveRig(prof.appearance, prof.equip, {}, prof.tenue, view));
    const x = 110 + i * CW, y = 30 + r * CH, cx = (CW - 6) / 2;
    cells.push(`<g transform="translate(${x},${y})"><rect width="${CW - 6}" height="${CH - 10}" fill="#2b3142"/><g transform="translate(${cx - 60 * SC},${FEET - 150 * SC}) scale(${SC})">${inner}</g><text x="${cx}" y="${CH - 12}" text-anchor="middle" font-size="11" fill="#cdd" font-family="sans-serif">${view}</text></g>`);
  });
});
const W = 110 + 3 * CW, H = 30 + NAMES.length * CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${defsGlobaux()}</defs><rect width="${W}" height="${H}" fill="#11141c"/>${cells.join('')}</svg>`;
writeFileSync('public/qc/_qc-newbiped.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: Math.min(1900, W) } }).render().asPng());
console.log('OK _qc-newbiped.png');
