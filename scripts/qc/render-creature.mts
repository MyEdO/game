/**
 * QC — rend UNE créature riguée NON bipède (profil + face, PNG zoomé) pour audit/retouche/jugement ;
 * un def de plan `biped`, un id inconnu ou une espèce absente de son plan LÈVENT (#646).
 *   npx tsx scripts/qc/render-creature.mts <id du def> <dossier-de-sortie> [prefixe-fichier]
 *     → <dossier-de-sortie>/<prefixe>-profile.png + <prefixe>-front.png (préfixe par défaut : l'id)
 *   npx tsx scripts/qc/render-creature.mts --list   → JSON [{ id, label, plan }] des créatures riguées non bipèdes
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { defsGlobaux } from '../../src/gameIso/sprites';
import { CREATURES } from '../../src/gameIso/rig/creatures';
import type { View } from '../../src/gameIso/rig/facing';
import { dossierDeSortie, svgDeDef } from './aveugle.mjs';

const USAGE = 'npx tsx scripts/qc/render-creature.mts <id du def> <dossier-de-sortie> [prefixe-fichier]';
const args = process.argv.slice(2);
if (args[0] === '--list') {
  const list = CREATURES.filter((c) => c.plan !== 'biped').map((c) => ({ id: c.id, label: c.label, plan: c.plan }));
  console.log(JSON.stringify(list, null, 1));
  process.exit(0);
}

const id = args[0];
if (!id) { console.error(`usage: ${USAGE}`); process.exit(1); }
const outDir = dossierDeSortie(args[1], USAGE);
const prefix = args[2] ?? id;

for (const view of ['profile', 'front'] as View[]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150" width="120" height="150"><defs>${defsGlobaux()}</defs><rect width="120" height="150" fill="#1d2230"/>${svgDeDef(id, view).svg}</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 620 }, font: { loadSystemFonts: true } }).render().asPng();
  const f = join(outDir, `${prefix}-${view}.png`);
  writeFileSync(f, png);
  console.log('OK:', f);
}
