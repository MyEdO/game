/** QC production du gabarit QUADRUPÈDE : espèces × {face/profil/dos/marche/morsure/mort/recolor}.
 *  Rend via le pipeline ResolvedBone[] → bonesToSvg (le même que les héros). Headless, pas de navigateur.
 *  → public/qc/quad.png. Lancer : npx tsx scripts/_qc-quad.mts */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { defsGlobaux } from '../src/gameIso/sprites';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { resolveQuad } from '../src/gameIso/rig/quadruped/composeQuad';
import { quadWalkPose, quadBitePose, QUAD_DEATH } from '../src/gameIso/rig/quadruped/quadPose';
import { quadSpeciesNames } from '../src/gameIso/rig/quadruped/quadSkeleton';
import { VIEWS, VIEW_LABEL, type View } from '../src/gameIso/rig/facing';

const draw = (sp: string, view: View, pose = {}, colors?: Record<string, string>) =>
  bonesToSvg(resolveQuad(sp, view, pose, colors));

const CW = 128, CH = 158, FEET = 150;
const COLUMNS: { label: string; svg: (sp: string) => string }[] = [
  ...VIEWS.map((view) => ({ label: VIEW_LABEL[view], svg: (sp: string) => draw(sp, view) })),
  { label: 'marche', svg: (sp) => draw(sp, 'profile', quadWalkPose(0.25)) },
  { label: 'morsure', svg: (sp) => draw(sp, 'profile', quadBitePose(0.7)) },
  { label: 'mort', svg: (sp) => draw(sp, 'profile', QUAD_DEATH) }, // = chemin jeu (pose sur le flanc, pas de bascule 78°)
  { label: 'recolor', svg: (sp) => draw(sp, 'profile', {}, { corps: '#8a2f2f', cheveux: '#1a1a1f' }) },
];

const species = quadSpeciesNames();
const cells: string[] = [];
species.forEach((sp, r) => {
  cells.push(`<text x="6" y="${30 + r * CH + CH / 2}" font-size="11" fill="#9fb0c8" font-family="sans-serif">${sp}</text>`);
  COLUMNS.forEach((col, ci) => {
    const x = 92 + ci * CW, y = 30 + r * CH;
    cells.push(
      `<g transform="translate(${x},${y})">` +
        `<rect width="${CW - 4}" height="${CH - 12}" fill="#262d3b"/>` +
        `<line x1="0" y1="${FEET}" x2="${CW - 4}" y2="${FEET}" stroke="#e06a4a" stroke-width="0.5"/>` +
        `<line x1="${(CW - 4) / 2}" y1="0" x2="${(CW - 4) / 2}" y2="${CH - 12}" stroke="#39507a" stroke-width="0.4"/>` +
        col.svg(sp) +
        `<text x="${(CW - 4) / 2}" y="${CH - 2}" text-anchor="middle" font-size="9" fill="#cdd" font-family="sans-serif">${col.label}</text>` +
      `</g>`,
    );
  });
});

mkdirSync('public/qc', { recursive: true });
const W = 92 + COLUMNS.length * CW, H = 30 + species.length * CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${defsGlobaux()}</defs><rect width="${W}" height="${H}" fill="#11141c"/><text x="12" y="20" font-size="15" fill="#d8a93b" font-family="sans-serif">Gabarit QUADRUPÈDE (prod) — ${species.length} espèces × ${COLUMNS.length} colonnes (pipeline ResolvedBone[])</text>${cells.join('')}</svg>`;
writeFileSync('public/qc/quad.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: Math.min(2400, W * 2) } }).render().asPng());
console.log(`OK → public/qc/quad.png (${species.length} espèces × ${COLUMNS.length} colonnes)`);
