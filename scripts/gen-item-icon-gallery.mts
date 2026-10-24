/**
 * Galerie QC des ICÔNES d'objet (primitive ItemIcon — Sac / onglet Combat / hotbar) : toutes les
 * possessions d'arme du catalogue (et les formes proposées d'une arme abstraite) + les boucliers +
 * l'armure (matériau × emplacement). Vérifie que CHAQUE objet produit une icône reconnaissable (pas de
 * glyphe par défaut, pas de plantage).
 * NB : le cadrage serré (getBBox) est appliqué EN JEU ; ce rendu SSR statique utilise le viewBox de
 * repli (donc moins serré). Lancer : npx tsx scripts/gen-item-icon-gallery.mts
 */
import { writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { ItemIcon } from '../src/ui/ItemIcon';
import { findTrappingById, trappingsInstanciables, weaponGroups } from '../src/data';
import { choisirApparenceDObjet, formeResolue, isShieldItem, itemFromTrappingById } from '../src/engine/items';
import type { HitLocation, ItemInstance } from '../src/engine/types';

const cell = (label: string, node: React.ReactElement) =>
  `<figure style="margin:0;text-align:center">${renderToStaticMarkup(node)}
    <figcaption style="color:#cdd;font:10px sans-serif;margin-top:2px">${label}</figcaption></figure>`;
const grid = (cells: string[]) =>
  `<div style="display:grid;grid-template-columns:repeat(auto-fill,84px);gap:10px">${cells.join('')}</div>`;

// #2967
const objets = trappingsInstanciables()
  .filter((t) => t.categorie === 'melee' || t.categorie === 'ranged')
  .map((t) => itemFromTrappingById(t.id)!);
const icone = (label: string, item: ItemInstance) => cell(label, React.createElement(ItemIcon, { item, size: 64 }));
const weaponCells = objets.filter((it) => !isShieldItem(it)).flatMap((it) => {
  const choix = findTrappingById(it.trappingId!)?.formChoices ?? [];
  return [icone(it.label, it), ...choix.filter((f) => f !== formeResolue(it)).map((f) => {
    const apercu = structuredClone(it);
    choisirApparenceDObjet(apercu, f, findTrappingById);
    return icone(`${it.label} · ${f}`, apercu);
  })];
});

// Boucliers (art dédié à dégradés → ItemIcon injecte ses <defs>).
const shieldCells = objets.filter(isShieldItem).map((it) => icone(it.label, it));

// Armures : matériau × emplacement (ItemIcon choisit le slot réellement couvert par la pièce). Les
// matériaux sont les Groupes d'armure de `weaponGroups.json`.
const MATS = weaponGroups.filter((g) => g.kind === 'armour');
const SLOTS: [label: string, loc: HitLocation][] = [['tête', 'tete'], ['torse', 'corps'], ['bras', 'brasG'], ['jambes', 'jambeG']];
const armourCells: string[] = [];
for (const { id: mat, label: matiere } of MATS) {
  for (const [slotLabel, loc] of SLOTS) {
    const item: ItemInstance = { uid: `${mat}-${loc}`, label: `${matiere} ${slotLabel}`, kind: 'armor', subType: mat, qualities: [], enc: 0, equipped: false, pa: 1, locs: [loc] };
    armourCells.push(cell(`${matiere} · ${slotLabel}`, React.createElement(ItemIcon, { item, size: 56 })));
  }
}

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Icônes d'objet QC</title></head>
<body style="background:#11141c;padding:16px">
<a href="galeries.html" style="color:#8fb6ff;font:13px sans-serif">← Galeries</a>
<h1 style="color:#eee;font:18px sans-serif">Icônes d'objet (ItemIcon) — ${weaponCells.length} armes · ${shieldCells.length} boucliers · ${armourCells.length} armures</h1>
<p style="color:#8a93a6;font:12px sans-serif">Rendu de la primitive <b>ItemIcon</b> (Sac / onglet Combat / hotbar). Cadrage serré (getBBox) appliqué EN JEU ; ce rendu SSR statique utilise le viewBox de repli (moins serré).</p>
<h2 style="color:#d8a93b;font:14px sans-serif;margin:18px 0 6px">Armes (${weaponCells.length})</h2>${grid(weaponCells)}
<h2 style="color:#d8a93b;font:14px sans-serif;margin:18px 0 6px">Boucliers</h2>${grid(shieldCells)}
<h2 style="color:#d8a93b;font:14px sans-serif;margin:18px 0 6px">Armures (matériau × emplacement)</h2>${grid(armourCells)}
</body></html>`;
writeFileSync('public/item-icon-gallery.html', html);
console.log(`OK: public/item-icon-gallery.html (${weaponCells.length} armes, ${shieldCells.length} boucliers, ${armourCells.length} armures)`);
