/** TEMP — face/profil/dos côte à côte pour PLUSIEURS carrières, afin de juger la cohérence
 *  inter-vues et repérer celles à doter d'un art orienté dédié. */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { defsGlobaux } from '../src/gameIso/sprites';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { resolveRig } from '../src/gameIso/rig/composeRig';
import type { Appearance } from '../src/gameIso/rig/appearance';
import { asRigSpeciesId } from '../src/gameIso/rig/appearance';
import { VIEWS } from '../src/gameIso/rig/facing';
import { tenueLabel } from '../src/gameIso/rig/parts/career';
import { assertWardrobeId } from './_lib-wardrobe';

const app: Appearance = { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: 1 };
const equip = { weapons: [], armour: [] };
// Garde-robes à inspecter, par ID (carrière ∪ classe ∪ tenue) — passées en argv sinon défaut ;
// le libellé du catalogue sert d'étiquette. Garde fail-fast : un id qui retombe sur « nu »
// n'aurait aucune cohérence inter-vues à juger (#1338).
const CAREERS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['mendiant', 'voleur', 'sorcier', 'noble', 'nonne', 'batelier', 'repurgateur', 'flagellant', 'artisan', 'bourgeois', 'agitateur'];
for (const id of CAREERS)
  assertWardrobeId(id, 'qc-careers-views');

const SUB = 120, GAP = 6, SC = 1.95, FEET = 150, ROWH = 305;
// 3 sous-vues par carrière, étiquette à gauche.
const LBLW = 92;
const rows = CAREERS.map((career, r) => {
  const cells = VIEWS.map((view, c) => {
    const inner = bonesToSvg(resolveRig(app, equip, {}, career, view));
    const x = LBLW + c * (SUB + GAP);
    return `<g transform="translate(${x},0)"><rect width="${SUB}" height="${ROWH - GAP}" fill="#2b3142"/><line x1="0" y1="${FEET * SC}" x2="${SUB}" y2="${FEET * SC}" stroke="#e06a4a" stroke-width="0.4" opacity="0.5"/><g transform="translate(${SUB / 2 - 60 * SC},0) scale(${SC})">${inner}</g></g>`;
  }).join('');
  return `<g transform="translate(6,${30 + r * ROWH})"><text x="0" y="${ROWH / 2}" font-size="10" fill="#d8a93b" font-family="sans-serif">${tenueLabel(career)}</text>${cells}</g>`;
});
const W = 6 + LBLW + VIEWS.length * (SUB + GAP), H = 30 + CAREERS.length * ROWH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${defsGlobaux()}</defs><rect width="${W}" height="${H}" fill="#11141c"/><text x="6" y="18" font-size="11" fill="#cdd" font-family="sans-serif">Carrières — face / profil / dos (cohérence inter-vues)</text>${rows.join('')}</svg>`;
writeFileSync('public/qc/careers-views.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W * 2 } }).render().asPng());
console.log('OK careers-views.png —', CAREERS.join(', '));
