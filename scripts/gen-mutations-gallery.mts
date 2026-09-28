/**
 * Galerie QC des MUTATIONS physiques (LDB 19) : chaque mutation rendue sur le rig
 * (calques/morpho/peau/membres remplacés), vues de l'art orienté, collisions avec
 * l'armure équipée, et mutants ennemis tirés au seed.
 * Lancer : npx tsx scripts/gen-mutations-gallery.mts → public/mutations-gallery.html
 */
import { writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite, rigComposition } from '../src/gameIso/rig/composeRig';
import { defsGlobaux } from '../src/gameIso/sprites';
import { combatantOverlays, combatantAppearance } from '../src/gameIso/rig/parts/combatantVisuals';
import { creatureToCombatant } from '../src/state/spawn';
import { findCreatureById } from '../src/data';
import { EYE_OPTIONS } from '../src/gameIso/rig/parts/eyes';
import { idsPhysiques, mutationById } from '../src/data/mutations';
import type { Mutation } from '../src/engine/corruption';
import type { Combatant, Trauma } from '../src/engine/types';
import type { Appearance } from '../src/gameIso/rig/appearance';
import { asRigSpeciesId } from '../src/gameIso/rig/appearance';
import type { EquipCtx } from '../src/gameIso/rig/parts/equipment';
import type { RigOverlay } from '../src/gameIso/rig/bones';
import { VIEWS, type View } from '../src/gameIso/rig/facing';
import type { ItemInstance, Weapon } from '../src/engine/types';
import { assertWardrobeId } from './_lib-wardrobe';

// la tenue de `rigComposition` se résout par ID de garde-robe (carrière ∪ classe ∪ tenue) — ids seulement,
// validés fail-fast : un id qui retombe sur « nu » masquerait la mutation sous un corps nu (#1338).
const TENUE_DEFAUT = 'mendiant';
const TENUE_SOLDAT = 'soldat';
for (const id of [TENUE_DEFAUT, TENUE_SOLDAT])
  assertWardrobeId(id, 'mutations-gallery');

const APP: Appearance = { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: 4 };
const NU: EquipCtx = { weapons: [], armour: [] };
const mut = (id: string): Mutation => mutationById(id)!;

function cell(label: string, app: Appearance, overlays: RigOverlay[], opts: { view?: View; equip?: EquipCtx; career?: string; bg?: string; tint?: string } = {}): string {
  const svg = renderToStaticMarkup(
    React.createElement('svg', { viewBox: '0 0 120 150', width: 110, height: 138 },
      React.createElement('defs', { dangerouslySetInnerHTML: { __html: defsGlobaux() } }),
      React.createElement('rect', { x: 0, y: 0, width: 120, height: 150, fill: opts.bg ?? '#1d2230' }),
      React.createElement(RigSprite, { comp: rigComposition(app, opts.equip ?? NU, opts.career ?? TENUE_DEFAUT, opts.view ?? 'front', overlays) }),
    ),
  );
  return `<figure style="margin:0;text-align:center"><div>${svg}</div><figcaption style="color:${opts.tint ?? '#cdd'};font:11px sans-serif">${label}</figcaption></figure>`;
}

const mutCell = (id: string, opts: Parameters<typeof cell>[3] = {}) => {
  const m = mut(id);
  const c = { mutations: [m] } as unknown as Combatant;
  return cell(opts.view ? `${m.label} — ${opts.view}` : m.label, combatantAppearance(APP, c), combatantOverlays(c), opts);
};

const sections: string[] = [];
const section = (title: string, cells: string[]) =>
  sections.push(`<h2 style="color:#eee;font:15px sans-serif;margin:22px 0 8px">${title}</h2>`
    + `<div style="display:grid;grid-template-columns:repeat(auto-fill,120px);gap:14px">${cells.join('')}</div>`);

// 1) La table physique complète, de face.
section('Tableau de Corruption physique (LDB 19) — vue de face', idsPhysiques().map((id) => mutCell(id)));

// 2) Vues de l'art orienté : détails de visage (face seule), membres remplacés, morpho.
const VUES = ['groin-poilu', 'visage-inverse', 'cornes-asymetriques', 'tentacule-epais', 'pattes-d-animaux', 'plumes-eparses', 'court-sur-pattes', 'corpulent', 'emacie'];
section('Vues — les détails de visage disparaissent de dos/profil', VUES.flatMap((id) =>
  VIEWS.map((view) => mutCell(id, { view }))));

// 3) Collisions avec l'armure équipée + arme en main (Soldat cuirassé).
const piece = (uid: string, pa: number, locs: ItemInstance['locs']): ItemInstance =>
  ({ uid, label: `Protection (${locs![0]})`, kind: 'armor', qualities: [], pa, locs, enc: 0, equipped: true });
const ARMOUR: ItemInstance[] = [piece('a1', 3, ['corps']), piece('a2', 2, ['tete']), piece('a3', 1, ['brasG', 'brasD']), piece('a4', 1, ['jambeG', 'jambeD'])];
const EPEE: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] };
const SOLDAT: Parameters<typeof cell>[3] = { equip: { weapons: [EPEE], armour: ARMOUR }, career: TENUE_SOLDAT, bg: '#222a24', tint: '#be9' };
section('Sur armure équipée (épée en main)', [
  'suintement-de-pus', 'bouche-supplementaire', 'ecailles-epineuses', 'plumes-eparses', 'peau-d-acier',
  'tentacule-epais', 'doigts-distendus', 'pattes-d-animaux', 'cornes-asymetriques',
].map((id) => mutCell(id, SOLDAT)));

// 4) Mutants ennemis : visuels DATA-DRIVEN du bestiaire (trait « Mutation (Cornes asymétriques) » =
// tell garanti + trait « Mutation » = tirage), chemin réel spawn→combatantOverlays. Plus de tirage
// d'overlays dans le rendu (POC isMutant/randomMutationOverlays retiré).
const mutantDef = findCreatureById('mutant')!;
section('Mutants ennemis — mutation DATA-DRIVEN (cornes garanties + tirage par id)', ['a', 'b', 'c', 'd', 'e', 'f'].map((k) => {
  const c = creatureToCombatant(mutantDef, `gal-mut-${k}`, { x: 0, y: 0 });
  return cell(`Mutant ${k}`, combatantAppearance(APP, c), combatantOverlays(c), { bg: '#2a1d22', tint: '#e9b' });
}));

// 5) Amputations & prothèses (LDB 18/73, injuries.ts) : séquelle nue puis prothèse portée.
const trauma = (over: Partial<Trauma>): Trauma => ({ label: 'x', location: 'tete', ...over });
const wounded = (traumas: Trauma[], prosthesis?: string): Combatant =>
  ({ id: 'g', name: 'G', kind: 'hero', traumas, items: prosthesis ? [{ uid: 'p', name: prosthesis, kind: 'misc', qualities: [], enc: 0, equipped: true }] : [] }) as unknown as Combatant;
const MAIN_D = trauma({ label: 'Main/bras amputé (brasD)', location: 'brasD', ops: [{ op: 'maxWeaponHands', hands: 1 }] });
const JAMBE_G = trauma({ label: 'Membre inférieur amputé (jambeG)', location: 'jambeG', ops: [{ op: 'moveScale', num: 1, den: 2 }] });
const INJ: { label: string; c: Combatant }[] = [
  { label: 'Main amputée (moignon)', c: wounded([MAIN_D]) },
  { label: 'Crochet porté', c: wounded([MAIN_D], 'Crochet') },
  { label: 'Merveille d’ingénierie', c: wounded([MAIN_D], "Merveille d'ingénierie") },
  { label: 'Fausse jambe', c: wounded([JAMBE_G], 'Fausse jambe') },
  { label: 'Œil perdu', c: wounded([trauma({ label: 'Œil perdu' })]) },
  { label: 'Cache-œil', c: wounded([trauma({ label: 'Œil perdu' })], 'Cache-œil') },
  { label: 'Œil de verre', c: wounded([trauma({ label: 'Œil perdu' })], 'Œil de verre') },
  { label: 'Cécité (bandage)', c: wounded([trauma({ label: 'Cécité' })]) },
  { label: 'Nez amputé', c: wounded([trauma({ label: 'Nez amputé' })]) },
  { label: 'Nez doré', c: wounded([trauma({ label: 'Nez amputé' })], 'Nez doré') },
];
section('Amputations &amp; prothèses (LDB 18 / 73)', INJ.map(({ label, c }) =>
  cell(label, combatantAppearance(APP, c), combatantOverlays(c), { career: TENUE_SOLDAT, bg: '#241f2a', tint: '#caf' })));

// 6) Catalogue d'yeux personnalisés (parts/eyes.ts) — mutations custom, créatures, éditeur.
section('Yeux personnalisés (catalogue)', Object.values(EYE_OPTIONS).map(({ label, art }) =>
  cell(label, { ...APP, eyes: { G: art, D: art } }, [], { bg: '#1f2430', tint: '#9cf' })));

// 7) Visuels de TRAITS (traitVisuals.ts) en 3 VUES — les appendices dorsaux (ailes, queue)
// sont LES récidivistes des bugs de vue/profondeur : chaque regen les montre sous tous les angles.
const TRAITS: { label: string; traits: string[] }[] = [
  { label: 'Vol (ailes)', traits: ['Vol 90'] },
  { label: 'Attaque caudale (queue)', traits: ['Attaque caudale +8'] },
  { label: 'Cornes', traits: ['Cornes +6'] },
  { label: 'Tentacules', traits: ['8 Tentacules +9'] },
];
const traitC = (traits: string[]): Combatant => ({ id: 't', name: 'T', kind: 'hero', species: 'humains-reiklander', traits }) as unknown as Combatant;
section('Traits de créature → visuels (statbloc / sorts) — 3 vues', TRAITS.flatMap(({ label, traits }) =>
  VIEWS.map((view) =>
    cell(`${label} — ${view}`, APP, combatantOverlays(traitC(traits)), { view, career: TENUE_SOLDAT, bg: '#23202c', tint: '#fc9' }))));

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Mutations QC</title></head>
<body style="background:#11141c;padding:16px">
<h1 style="color:#eee;font:18px sans-serif">Galerie QC — mutations physiques (LDB 19) sur le rig</h1>
${sections.join('')}
</body></html>`;

writeFileSync('public/mutations-gallery.html', html);
console.log('OK: public/mutations-gallery.html');
