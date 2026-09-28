/** QC une espèce, 3 vues en TRÈS grand (étude détaillée). Usage: npx tsx scripts/_qc-one3.mts Loup */
import { VIEWS } from '../src/gameIso/rig/facing';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { defsGlobaux } from '../src/gameIso/sprites';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { resolveQuad } from '../src/gameIso/rig/quadruped/composeQuad';

const sp = process.argv[2] ?? 'Loup';
const CW = 120, CH = 152, FEET = 150;
const cells = VIEWS.map((view, ci) =>
  `<g transform="translate(${ci * CW},0)"><rect width="${CW}" height="${CH}" fill="#26323a"/>` +
  `<line x1="0" y1="${FEET}" x2="${CW}" y2="${FEET}" stroke="#c0563a" stroke-width="0.4"/>` +
  bonesToSvg(resolveQuad(sp, view)) +
  `<text x="${CW / 2}" y="${CH - 2}" text-anchor="middle" font-size="9" fill="#cdd">${view}</text></g>`,
).join('');
mkdirSync('public/qc', { recursive: true });
const W = VIEWS.length * CW, H = CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${defsGlobaux()}</defs><rect width="${W}" height="${H}" fill="#11141c"/>${cells}</svg>`;
writeFileSync('public/qc/one3.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W * 4 } }).render().asPng());
console.log('OK', sp);
