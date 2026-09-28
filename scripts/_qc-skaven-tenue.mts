/** QC de la TENUE de carrière « Skaven » (guerrier-rat famélique en armure de récup).
 *  Rend un skaven qui PORTE la tenue Skaven (career:'skaven') en face/profil/dos, pour
 *  comparer au look voulu : plastron de lamelles d'acier dépareillées sanglé de cuir,
 *  bras en pelage (poing libre qui raccorde), jambes pelage + haillons, tête de rat
 *  (pas de couvre-chef). → public/qc/skaven-tenue.png */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { defsGlobaux } from '../src/gameIso/sprites';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { resolveRig } from '../src/gameIso/rig/composeRig';
import type { Appearance } from '../src/gameIso/rig/appearance';
import { asRigSpeciesId } from '../src/gameIso/rig/appearance';
import type { EquipCtx } from '../src/gameIso/rig/parts/equipment';
import { VIEWS } from '../src/gameIso/rig/facing';
import { assertWardrobeId } from './_lib-wardrobe';

// Tenue sondée : ID de garde-robe (carrière ∪ classe ∪ tenue), validée fail-fast — un id qui
// retombe sur « nu » rendrait un rat nu au lieu de l'armure de récup (#1338).
const TENUE_SKAVEN = 'skaven';
assertWardrobeId(TENUE_SKAVEN, 'qc-skaven-tenue');

const appearance: Appearance = {
  species: asRigSpeciesId('skaven'),
  sex: 'M',
  build: 0.5,
  seed: 1,
  monster: { tete: 'rat', queue: true },
};
const equip: EquipCtx = {
  weapons: [{ label: 'Hache', type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: [] }],
  armour: [],
};

const CW = 250, CH = 360, SC = 2.2, FEET = 320;
const cells: string[] = [];
VIEWS.forEach((view, i) => {
  const inner = bonesToSvg(resolveRig(appearance, equip, {}, TENUE_SKAVEN, view));
  const x = 90 + i * CW, y = 30;
  cells.push(`<g transform="translate(${x},${y})"><rect width="${CW - 6}" height="${CH - 10}" fill="#2b3142"/><line x1="0" y1="${FEET}" x2="${CW - 6}" y2="${FEET}" stroke="#e06a4a" stroke-width="0.5" opacity="0.5"/><g transform="translate(${(CW - 6) / 2 - 60 * SC},${FEET - 150 * SC}) scale(${SC})">${inner}</g><text x="${(CW - 6) / 2}" y="${CH - 14}" text-anchor="middle" font-size="10" fill="#cdd" font-family="sans-serif">${view}</text></g>`);
});
const W = 90 + 3 * CW, H = 30 + CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${defsGlobaux()}</defs><rect width="${W}" height="${H}" fill="#11141c"/><text x="6" y="18" font-size="13" fill="#d8a93b" font-family="sans-serif">QC tenue SKAVEN — guerrier-rat en armure de récup (career:'skaven', tête de rat auto)</text>${cells.join('')}</svg>`;
writeFileSync('public/qc/skaven-tenue.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W * 2 } }).render().asPng());
console.log('OK skaven-tenue.png');
