/**
 * Galerie QC des vues de TENUE : rend le RIG COMPLET en front/profil/dos pour chaque tenue
 * SPÉCIFIQUE du registre `defs/`, pour valider le torse dos/profil en contexte.
 * Lancer : npx tsx scripts/gen-tenue-views-gallery.mts → public/tenue-views.html
 */
import { writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite, rigComposition } from '../src/gameIso/rig/composeRig';
import { defsGlobaux } from '../src/gameIso/sprites';
import { SPECIFIC_TENUES } from '../src/gameIso/rig/parts/tenues';
import { assertTenueCatalogId } from './_lib-wardrobe';
import type { Appearance } from '../src/gameIso/rig/appearance';
import { asRigSpeciesId } from '../src/gameIso/rig/appearance';
import { VIEWS, type View } from '../src/gameIso/rig/facing';

const app: Appearance = { species: asRigSpeciesId('humain'), sex: 'M', build: 0.55, seed: 4 };
// `career` se résout par ID (`TENUE_BY_ID`) : la planche itère les ids du catalogue, le libellé
// n'est que la légende de la rangée. Garde fail-fast — un id non résolu est une faute
// d'authoring, jamais un repli Nu silencieux (#1338, patron #1326).
const tenues = SPECIFIC_TENUES.slice().sort((a, b) => a.label.localeCompare(b.label, 'fr'));
for (const t of tenues)
  assertTenueCatalogId(t.id, 'tenue-views');

function cell(career: string, view: View) {
  const svg = renderToStaticMarkup(
    React.createElement('svg', { viewBox: '0 0 120 150', width: 92, height: 115 },
      React.createElement('defs', { dangerouslySetInnerHTML: { __html: defsGlobaux() } }),
      React.createElement('rect', { x: 0, y: 0, width: 120, height: 150, fill: view === 'back' ? '#241a1a' : '#1b1f2b' }),
      React.createElement(RigSprite, { comp: rigComposition(app, { weapons: [], armour: [] }, career, view) }),
    ),
  );
  return `<figure style="margin:0;text-align:center"><div>${svg}</div><figcaption style="color:#bcd;font:10px sans-serif">${view}</figcaption></figure>`;
}

const rows = tenues.map((c) =>
  `<div style="display:flex;align-items:center;gap:10px;margin:4px 0;border-bottom:1px solid #222">
     <div style="width:140px;color:#eee;font:12px sans-serif">${c.label}</div>
     <div style="display:flex;gap:8px">${VIEWS.map((view) => cell(c.id, view)).join('')}</div>
   </div>`,
);

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Tenues — vues</title></head>
<body style="background:#11141c;padding:16px">
<h1 style="color:#eee;font:18px sans-serif">Tenues — vues dos/profil — ${tenues.length} tenues</h1>
<p style="color:#9ab;font:12px sans-serif">Rig complet (Humain M) en face/profil/dos. Le torse de dos doit être cohérent (sans détails de face), le profil plus étroit.</p>
${rows.join('')}
</body></html>`;
writeFileSync('public/tenue-views.html', html);
console.log(`OK: public/tenue-views.html (${tenues.length} tenues × 3 vues)`);
