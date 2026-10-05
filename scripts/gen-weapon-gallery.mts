/**
 * Galerie QC EXHAUSTIVE des armes : chaque arme du Livre de base (+ ADE) tenue par
 * un soldat humain riggé, groupée par Groupe canonique (WFRP4), étiquetée avec sa
 * FORME d'art résolue (weaponFamily). Permet de vérifier que TOUTE arme a un visuel
 * lisible. Lancer : npx tsx scripts/gen-weapon-gallery.mts → public/weapon-gallery.html
 */
import { writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite, rigComposition } from '../src/gameIso/rig/composeRig';
import { defsGlobaux } from '../src/gameIso/sprites';
import { armeDeDessin, bouclierDeDessin, equipDe, isShield, weaponFamily } from '../src/gameIso/rig/parts/equipment';
import { itemFromTrappingById, weaponFromItem } from '../src/engine/items';
import { trappingsInstanciables, weaponGroups } from '../src/data';
import { assertWardrobeId } from './_lib-wardrobe';
import type { Weapon } from '../src/engine/types';
import { asRigSpeciesId } from '../src/gameIso/rig/appearance';

// Groupes de COMBAT du registre canonique (`weaponGroups.json` — `combat` renseigné) : le
// générateur lit les IDS, `label` ne sert qu'au titre de rubrique ; une arme porte l'id de son Groupe
// en `subType` (#1338).
const GROUPS = weaponGroups.filter((g) => g.combat === 'melee' || g.combat === 'ranged');
const GROUP_IDS = new Set(GROUPS.map((g) => g.id));
const all = trappingsInstanciables().filter(
  (t) => (t.categorie === 'melee' || t.categorie === 'ranged') && t.subType != null && GROUP_IDS.has(t.subType),
);
if (!all.length)
  throw new Error('[weapon-gallery] aucune arme sélectionnée — planche vide (registre de Groupes ou trappings.json désaccordés).');

// Mannequin de la planche : id de garde-robe, validé fail-fast (jamais un corps nu silencieux).
const MANNEQUIN = 'soldat';
assertWardrobeId(MANNEQUIN, 'weapon-gallery');

function fig(w: Weapon, shield = false) {
  const equip = shield
    ? { ...equipDe([], []), shield: bouclierDeDessin(w) }
    : equipDe([w], []);
  const svg = renderToStaticMarkup(
    React.createElement('svg', { viewBox: '0 0 120 150', width: 92, height: 115 },
      React.createElement('defs', { dangerouslySetInnerHTML: { __html: defsGlobaux() } }),
      React.createElement('rect', { x: 0, y: 0, width: 120, height: 150, fill: '#1d2230' }),
      React.createElement(RigSprite, { comp: rigComposition({ species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: 4 }, equip, MANNEQUIN) }),
    ),
  );
  const fam = shield ? 'bouclier' : weaponFamily(armeDeDessin(w)) || '(mains nues)';
  return `<figure style="margin:0;text-align:center"><div>${svg}</div>
    <figcaption style="color:#cdd;font:10.5px sans-serif">${w.label}<br><span style="color:#8a93a6">[${fam}]</span></figcaption></figure>`;
}

let body = '';
for (const g of GROUPS) {
  const ws = all.filter((t) => t.subType === g.id);
  if (!ws.length) continue;
  const cells = ws
    .map((t) => {
      const w = weaponFromItem(itemFromTrappingById(t.id)!);
      return fig(w, isShield(w)); // #2177
    })
    .join('');
  body += `<h2 style="color:#d8a93b;font:14px sans-serif;margin:18px 0 6px">${g.label} <span style="color:#6a7384;font-size:11px">(${ws.length})</span></h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,100px);gap:10px">${cells}</div>`;
}

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Armes QC</title></head>
<body style="background:#11141c;padding:16px">
<h1 style="color:#eee;font:18px sans-serif">Galerie QC des armes — ${all.length} armes (LDB + ADE), par Groupe canonique</h1>
<p style="color:#8a93a6;font:12px sans-serif">Chaque arme tenue par un soldat humain. <b>[forme]</b> = visuel d'art résolu (familles partagées par Groupe). Population : les possessions de type arme (corps à corps / à distance) dont le Groupe est un Groupe de combat du registre — munitions et engins de siège ont leurs propres planches.</p>
${body}
</body></html>`;
writeFileSync('public/weapon-gallery.html', html);
console.log(`OK: public/weapon-gallery.html (${all.length} armes)`);
