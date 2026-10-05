/** Galerie des tenues SPÉCIFIQUES (rig, art en jetons + palette par défaut), GRANDES vignettes.
 *  Inline SVG self-contained (`defsGlobaux` par vignette). Lancer : npx tsx scripts/gen-tenue-gallery.mts → public/tenue-gallery.html */
import { writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite, rigComposition } from '../src/gameIso/rig/composeRig';
import { defsGlobaux } from '../src/gameIso/sprites';
import { SPECIFIC_TENUES } from '../src/gameIso/rig/parts/tenues';
import { assertTenueCatalogId } from './_lib-wardrobe';
import type { Appearance } from '../src/gameIso/rig/appearance';
import { asRigSpeciesId } from '../src/gameIso/rig/appearance';

// Le rig s'habille par ID de garde-robe (tenue de `rigComposition` = id de carrière/tenue) : la galerie
// itère les IDS du catalogue et n'affiche le `label` qu'en légende. Le résolveur VALIDE (fail-fast) :
// un id qui ne résout pas à lui-même est une faute d'authoring, jamais un repli Nu silencieux.
const tenues = SPECIFIC_TENUES.slice().sort((a, b) => a.label.localeCompare(b.label, 'fr'));
for (const t of tenues) {
  assertTenueCatalogId(t.id, 'tenue-gallery');
}
const SC = 1.85; // sprite natif ~120×150 → ~222×278
const CW = Math.round(120 * SC + 24);
const CH = Math.round(150 * SC + 16);
const app: Appearance = { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: 4 };

const cells = tenues
  .map(({ id, label }) => {
    const inner = renderToStaticMarkup(React.createElement(RigSprite, { comp: rigComposition(app, { weapons: [], armour: [] }, id) }));
    return (
      `<figure class="cell"><svg viewBox="0 0 ${CW} ${CH}" width="${CW}" height="${CH}"><defs>${defsGlobaux()}</defs>` +
      `<ellipse cx="${CW / 2}" cy="${CH - 14}" rx="${Math.round(30 * SC)}" ry="${Math.round(8 * SC)}" fill="#000" opacity="0.35"/>` +
      `<g transform="translate(${CW / 2 - 60 * SC},6) scale(${SC})">${inner}</g>` +
      `</svg><figcaption>${label}</figcaption></figure>`
    );
  })
  .join('');

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><title>Tenues de carrière</title>
<style>
  body{margin:0;background:#0a0810;color:#e8e0f0;font-family:sans-serif}
  h1{color:#d8a93b;margin:14px 20px} p.note{color:#9a90a8;margin:0 20px 8px;font-size:13px}
  .grid{display:flex;flex-wrap:wrap;gap:14px;padding:0 20px 40px}
  .cell{margin:0;background:#1d1726;border:1px solid #3a2f4a;border-radius:10px;padding:6px 6px 2px;display:flex;flex-direction:column;align-items:center}
  .cell svg{display:block}
  figcaption{color:#d8cce0;font-size:13px;text-align:center;padding:5px 2px 7px;max-width:${CW}px}
</style></head>
<body><h1>Tenues de carrière — ${tenues.length} tenues</h1>
<p class="note">Rig humanoïde, couleurs en jetons de palette (recoloriables par l'éditeur). Rendu au défaut par carrière.</p>
<div class="grid">${cells}</div></body></html>`;

writeFileSync('public/tenue-gallery.html', html, 'utf8');
console.log(`public/tenue-gallery.html : ${tenues.length} tenues`);
