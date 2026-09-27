/** QC des nouveaux ailés sortis du monolithique (Manticore, Varghulf) vs Griffon. */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { defsGlobaux } from '../src/gameIso/sprites';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { resolveWing, WINGED_SPECIES } from '../src/gameIso/rig/winged/composeWing';
import type { View } from '../src/gameIso/rig/facing';

const NAMES = ['Manticore', 'Varghulf', 'Griffon'];
const SHOWN_VIEWS: View[] = ['profile', 'front'];
const CW = 360, CH = 420, BASE = 1.45, FEET = 370;
const cells: string[] = [];
NAMES.forEach((name, r) => {
  const sl = WINGED_SPECIES[name].sl, SC = BASE * sl;
  cells.push(`<text x="8" y="${30 + r * CH + CH / 2}" font-size="16" fill="#d8a93b" font-family="sans-serif">${name}</text>`);
  SHOWN_VIEWS.forEach((view, i) => {
    const inner = bonesToSvg(resolveWing(name, view));
    const x = 120 + i * CW, y = 30 + r * CH, cx = (CW - 6) / 2;
    cells.push(`<g transform="translate(${x},${y})"><rect width="${CW - 6}" height="${CH - 10}" fill="#2b3142"/><line x1="0" y1="${FEET}" x2="${CW - 6}" y2="${FEET}" stroke="#e06a4a" stroke-width="0.5" opacity="0.4"/><g transform="translate(${cx - 60 * SC},${FEET - 150 * SC}) scale(${SC})">${inner}</g><text x="${cx}" y="${CH - 14}" text-anchor="middle" font-size="13" fill="#cdd" font-family="sans-serif">${view}</text></g>`);
  });
});
const W = 120 + 2 * CW, H = 30 + NAMES.length * CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${defsGlobaux()}</defs><rect width="${W}" height="${H}" fill="#11141c"/>${cells.join('')}</svg>`;
writeFileSync('public/qc/_qc-newwinged.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: Math.min(1900, W) } }).render().asPng());
console.log('OK _qc-newwinged.png');
