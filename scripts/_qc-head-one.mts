/** Une seule tête en GROS, vue au choix, pour régler le profil/dos finement. */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { defsGlobaux } from '../src/gameIso/sprites';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { resolveRig } from '../src/gameIso/rig/composeRig';
import type { Appearance } from '../src/gameIso/rig/appearance';
import { asRigSpeciesId } from '../src/gameIso/rig/appearance';
import { VIEWS, VIEW_LABEL } from '../src/gameIso/rig/facing';

const app: Appearance = { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: 1 };
const equip = { weapons: [], armour: [] };
// face | profil | dos côte à côte, GROS (zoom 9), + une grille de repère.
const COLUMNS = VIEWS.map((view) => ({ view, label: VIEW_LABEL[view] }));
const CW = 260, CH = 300, SC = 6, HCX = 60, HCY = 38;
const cells = COLUMNS.map((col, c) => {
  const inner = bonesToSvg(resolveRig(app, equip, {}, undefined, col.view));
  const cx = (CW - 8) / 2, cy = (CH - 12) / 2;
  return `<g transform="translate(${10 + c * CW},30)"><rect width="${CW - 8}" height="${CH - 12}" fill="#2b3142"/><g transform="translate(${cx - HCX * SC},${cy - HCY * SC}) scale(${SC})">${inner}</g><text x="${(CW - 8) / 2}" y="${CH - 16}" text-anchor="middle" font-size="10" fill="#cdd" font-family="sans-serif">${col.label}</text></g>`;
});
const W = 10 + COLUMNS.length * CW, H = 30 + CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${defsGlobaux()}</defs><rect width="${W}" height="${H}" fill="#11141c"/><text x="12" y="18" font-size="12" fill="#d8a93b" font-family="sans-serif">Humain M — tête en gros (réglage profil/dos)</text>${cells.join('')}</svg>`;
writeFileSync('public/qc/head-one.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W } }).render().asPng());
console.log('OK head-one.png');
