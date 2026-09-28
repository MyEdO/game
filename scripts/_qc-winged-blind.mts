/** QC AVEUGLE des ailés — sans label (n° seulement). → public/qc/_winged-blind.png */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { defsGlobaux } from '../src/gameIso/sprites';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { resolveWing, WINGED_SPECIES } from '../src/gameIso/rig/winged/composeWing';
import type { View } from '../src/gameIso/rig/facing';

// ordre mélangé pour ne pas suggérer un regroupement
const TRUTH = ['Dragon', 'Pégase', 'Griffon', 'Hippogriffe'];
const SHOWN_VIEWS: View[] = ['profile', 'front'];
const CW = 460, CH = 420, BASE = 1.25, FEET = 365, SUB = CW / 2;
const cells: string[] = [];
TRUTH.forEach((name, idx) => {
  const col = idx % 2, row = Math.floor(idx / 2);
  const ox = 10 + col * CW, oy = 30 + row * CH;
  const SC = BASE * WINGED_SPECIES[name].sl;
  cells.push(`<rect x="${ox}" y="${oy}" width="${CW - 8}" height="${CH - 10}" fill="#2b3142" stroke="#3a4156"/>`);
  cells.push(`<text x="${ox + 8}" y="${oy + 20}" font-size="16" fill="#e8c25a" font-family="sans-serif" font-weight="bold">#${idx + 1}</text>`);
  SHOWN_VIEWS.forEach((view, i) => {
    const inner = bonesToSvg(resolveWing(name, view));
    const sx = ox + i * SUB + SUB / 2;
    cells.push(`<g transform="translate(${sx - 60 * SC},${oy + FEET - 150 * SC}) scale(${SC})">${inner}</g>`);
  });
});
const W = 10 + 2 * CW, H = 30 + 2 * CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${defsGlobaux()}</defs><rect width="${W}" height="${H}" fill="#171b24"/><text x="10" y="20" font-size="14" fill="#9fb0c8" font-family="sans-serif">Identifie chaque creature ailee (profil + face)</text>${cells.join('')}</svg>`;
writeFileSync('public/qc/_winged-blind.png', new Resvg(full, { background: '#171b24', fitTo: { mode: 'width', value: W * 2 } }).render().asPng());
console.log('OK _winged-blind.png');
