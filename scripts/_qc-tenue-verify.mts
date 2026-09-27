/** Rend l'état ACTUEL (en jetons + CAREER_PALETTES défaut) de carrières données → public/qc/tenue-new/<slug>.png
 *  À comparer aux originaux public/qc/tenue/<slug>.png. Lancer : npx tsx scripts/_qc-tenue-verify.mts */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { defsGlobaux } from '../src/gameIso/sprites';
import type { Appearance } from '../src/gameIso/rig/appearance';
import { asRigSpeciesId } from '../src/gameIso/rig/appearance';
import { assertWardrobeId } from './_lib-wardrobe';

// IDS de garde-robe (carrière ∪ classe ∪ tenue) — ils nomment aussi le fichier de sortie, à
// l'identique des originaux. Garde fail-fast : un id qui retombe sur « nu » comparerait un corps
// nu à une tenue (#1338).
const CAREERS = ['batelier', 'apothicaire', 'serviteur', 'soldat', 'mendiant', 'medecin', 'garde', 'villageois'];
for (const id of CAREERS)
  assertWardrobeId(id, 'qc-tenue-verify');
const app: Appearance = { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: 4 };
mkdirSync('public/qc/tenue-new', { recursive: true });
for (const career of CAREERS) {
  const inner = renderToStaticMarkup(React.createElement(RigSprite, { appearance: app, equip: { weapons: [], armour: [] }, career }));
  const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150"><defs>${defsGlobaux()}</defs>${inner}</svg>`;
  writeFileSync(`public/qc/tenue-new/${career}.png`, new Resvg(full, { background: '#2b3142', fitTo: { mode: 'width', value: 320 } }).render().asPng());
}
// Montage côte à côte : original (rendu d'avant la mise en jetons, à gauche) n'est pas réimportable ici
// → on rend juste les NOUVEAUX ; comparer avec public/qc/tenue/<slug>.png (originaux).
console.log('OK → public/qc/tenue-new/*.png (comparer aux public/qc/tenue/*.png)');
