/** QC corps entier : coiffures longues sur un personnage (vérifie que cheveux longs tombent bien). */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { defsGlobaux } from '../src/gameIso/sprites';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { resolveRig } from '../src/gameIso/rig/composeRig';
import type { Appearance } from '../src/gameIso/rig/appearance';
import { asRigSpeciesId } from '../src/gameIso/rig/appearance';
import type { View } from '../src/gameIso/rig/facing';
import type { Sexe } from '../src/data/schemas/grammaire/valeurs';

const bare = { weapons: [], armour: [] };
// F idx: 1=longs lâchés, 2=chignon, 3=queue haute, 4=tresses ; M idx 4=queue basse
const cases: { sex: Sexe; idx: number; label: string }[] = [
  { sex: 'F', idx: 1, label: 'F longs lâchés' },
  { sex: 'F', idx: 3, label: 'F queue haute' },
  { sex: 'F', idx: 4, label: 'F tresses' },
  { sex: 'M', idx: 4, label: 'M queue basse' },
];
const CW = 150, CH = 230, SC = 1.5, FEET = 196, LBLW = 120;
const views: View[] = ['front', 'profile', 'back'];
const cells: string[] = [];
cases.forEach((c, r) => {
  const app: Appearance = { species: asRigSpeciesId('humain'), sex: c.sex, build: 0.5, seed: 1, parts: { cheveux: c.idx } };
  cells.push(`<text x="6" y="${24 + r * CH + CH / 2}" font-size="12" fill="#d8a93b" font-family="sans-serif">${c.label}</text>`);
  views.forEach((v, i) => {
    const inner = bonesToSvg(resolveRig(app, bare, {}, 'Mendiant', v));
    const x = LBLW + i * CW, y = 24 + r * CH;
    cells.push(`<g transform="translate(${x},${y})"><rect width="${CW - 6}" height="${CH - 8}" fill="#2b3142"/><g transform="translate(${(CW - 6) / 2 - 60 * SC},${FEET - 150 * SC}) scale(${SC})">${inner}</g></g>`);
  });
});
const W = LBLW + views.length * CW, H = 24 + cases.length * CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${defsGlobaux()}</defs><rect width="${W}" height="${H}" fill="#11141c"/>${cells.join('')}</svg>`;
writeFileSync('public/qc/hair-body.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W * 2 } }).render().asPng());
console.log('OK hair-body.png');
