/** QC focalisé : une ou plusieurs carrières (argv), grandes vues face/profil/dos côte à côte. */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { defsGlobaux } from '../src/gameIso/sprites';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { resolveRig } from '../src/gameIso/rig/composeRig';
import type { Appearance } from '../src/gameIso/rig/appearance';
import { asRigSpeciesId } from '../src/gameIso/rig/appearance';
import { VIEWS, VIEW_LABEL } from '../src/gameIso/rig/facing';

const app: Appearance = { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: 1 };
const bare = { weapons: [], armour: [] };
const careers = process.argv.slice(2);
if (!careers.length) { console.error('usage: tsx _qc-one.mts <Carrière> [...]'); process.exit(1); }

const CW = 230, CH = 340, SC = 2.6, FEET = 296, LBLW = 96;
const COLUMNS = VIEWS.map((view) => ({ view, label: VIEW_LABEL[view] }));
const cells: string[] = [];
careers.forEach((career, r) => {
  cells.push(`<text x="8" y="${30 + r * CH + CH / 2}" font-size="16" fill="#d8a93b" font-family="sans-serif">${career}</text>`);
  COLUMNS.forEach((col, i) => {
    const inner = bonesToSvg(resolveRig(app, bare, {}, career, col.view));
    const x = LBLW + i * CW, y = 30 + r * CH;
    cells.push(
      `<g transform="translate(${x},${y})">` +
        `<rect width="${CW - 6}" height="${CH - 8}" fill="#2b3142"/>` +
        `<line x1="0" y1="${FEET}" x2="${CW - 6}" y2="${FEET}" stroke="#e06a4a" stroke-width="0.5" opacity="0.5"/>` +
        `<g transform="translate(${(CW - 6) / 2 - 60 * SC},${FEET - 150 * SC}) scale(${SC})">${inner}</g>` +
        `<text x="${(CW - 6) / 2}" y="${CH - 12}" text-anchor="middle" font-size="13" fill="#cdd" font-family="sans-serif">${col.label}</text>` +
      `</g>`,
    );
  });
});
const W = LBLW + COLUMNS.length * CW, H = 30 + careers.length * CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${defsGlobaux()}</defs><rect width="${W}" height="${H}" fill="#11141c"/>${cells.join('')}</svg>`;
writeFileSync('public/qc/one.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W } }).render().asPng());
console.log('OK one.png : ' + careers.join(', '));
