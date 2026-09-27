/** Diagnostic des TÊTES (visage + cheveux) en face/profil/dos, sans tenue.
 *  Isole le défaut « tête abominable » de profil/dos. Plusieurs espèces × sexes. */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { defsGlobaux } from '../src/gameIso/sprites';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { resolveRig } from '../src/gameIso/rig/composeRig';
import type { Appearance } from '../src/gameIso/rig/appearance';
import { asRigSpeciesId } from '../src/gameIso/rig/appearance';
import { VIEWS, VIEW_LABEL } from '../src/gameIso/rig/facing';

const equip = { weapons: [], armour: [] };
const COLUMNS = VIEWS.map((view) => ({ view, label: VIEW_LABEL[view] }));
const ROWS: { l: string; app: Appearance }[] = [
  { l: 'Humain M', app: { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: 1 } },
  { l: 'Humain M (2)', app: { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: 7 } },
  { l: 'Humain F', app: { species: asRigSpeciesId('humain'), sex: 'F', build: 0.5, seed: 3 } },
  { l: 'Nain M', app: { species: asRigSpeciesId('nain'), sex: 'M', build: 0.6, seed: 1 } },
  { l: 'Haut-Elfe F', app: { species: asRigSpeciesId('haut-elfe'), sex: 'F', build: 0.4, seed: 2 } },
];

// On ne rend QUE la tête : zoom fort sur la zone tête (boîte locale ~ y0..y30, x±14).
const CW = 160, CH = 175, SC = 5; // zoom ×5 sur la tête
// La tête (os cou+tête) est en coords MONDE autour de y≈28..52 (haut du corps, boîte 150).
// Centre voulu : x=60 (axe), y≈40. On amène ce point au centre de la cellule.
const HCX = 60, HCY = 40;
const cells: string[] = [];
ROWS.forEach((row, r) => {
  COLUMNS.forEach((col, c) => {
    const inner = bonesToSvg(resolveRig(row.app, equip, {}, undefined, col.view));
    const x = 10 + c * CW, y = 30 + r * CH;
    const cx = (CW - 8) / 2, cy = (CH - 12) / 2;
    cells.push(
      `<g transform="translate(${x},${y})">` +
        `<rect width="${CW - 8}" height="${CH - 12}" fill="#2b3142"/>` +
        `<g transform="translate(${cx - HCX * SC},${cy - HCY * SC}) scale(${SC})">${inner}</g>` +
        `<text x="${(CW - 8) / 2}" y="${CH - 16}" text-anchor="middle" font-size="9" fill="#cdd" font-family="sans-serif">${row.l} — ${col.label}</text>` +
      `</g>`,
    );
  });
});
const W = 10 + COLUMNS.length * CW, H = 30 + ROWS.length * CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${defsGlobaux()}</defs><rect width="${W}" height="${H}" fill="#11141c"/><text x="12" y="18" font-size="12" fill="#d8a93b" font-family="sans-serif">Têtes — visage + cheveux par vue (diagnostic profil/dos)</text>${cells.join('')}</svg>`;
writeFileSync('public/qc/head-views.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W * 2 } }).render().asPng());
console.log('OK head-views.png');
