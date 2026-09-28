/** QC du gabarit AILÉ — griffon / pégase / hippogriffe / dragon, vues face/profil/dos.
 *  L'échelle d'espèce (sl) est appliquée au scale de cellule → le dragon est géant. */
import { VIEWS } from '../src/gameIso/rig/facing';
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { defsGlobaux } from '../src/gameIso/sprites';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { resolveWing, WINGED_SPECIES } from '../src/gameIso/rig/winged/composeWing';

const NAMES = ['Griffon', 'Pégase', 'Hippogriffe', 'Dragon'];
const CW = 380, CH = 460, BASE = 1.5, FEET = 410;
const cells: string[] = [];
NAMES.forEach((name, r) => {
  const sl = WINGED_SPECIES[name].sl;
  const SC = BASE * sl;
  cells.push(`<text x="8" y="${30 + r * CH + CH / 2}" font-size="16" fill="#d8a93b" font-family="sans-serif">${name}</text>`);
  VIEWS.forEach((view, i) => {
    const inner = bonesToSvg(resolveWing(name, view));
    const x = 140 + i * CW, y = 30 + r * CH;
    const cx = (CW - 6) / 2;
    cells.push(`<g transform="translate(${x},${y})"><rect width="${CW - 6}" height="${CH - 10}" fill="#2b3142"/><line x1="0" y1="${FEET}" x2="${CW - 6}" y2="${FEET}" stroke="#e06a4a" stroke-width="0.5" opacity="0.4"/><g transform="translate(${cx - 60 * SC},${FEET - 150 * SC}) scale(${SC})">${inner}</g><text x="${cx}" y="${CH - 14}" text-anchor="middle" font-size="13" fill="#cdd" font-family="sans-serif">${view}</text></g>`);
  });
});
const W = 140 + 3 * CW, H = 30 + NAMES.length * CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${defsGlobaux()}</defs><rect width="${W}" height="${H}" fill="#11141c"/><text x="8" y="20" font-size="14" fill="#d8a93b" font-family="sans-serif">QC gabarit AILÉ (quadrupède + ailes ; dragon = ailé géant via sl)</text>${cells.join('')}</svg>`;
writeFileSync('public/qc/_qc-winged.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W } }).render().asPng());
console.log('OK _qc-winged.png');
