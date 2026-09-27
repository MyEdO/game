/**
 * Galerie QC du rig : compose RigSprite pour un panel d'espèces × sexe (+ variantes
 * d'équipement) et écrit public/rig-gallery.html. Lancer : npx tsx scripts/gen-rig-gallery.mts
 */
import { writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { defsGlobaux } from '../src/gameIso/sprites';
import type { Appearance } from '../src/gameIso/rig/appearance';
import { asRigSpeciesId } from '../src/gameIso/rig/appearance';
import type { EquipCtx } from '../src/gameIso/rig/parts/equipment';
import type { Weapon, ItemInstance } from '../src/engine/types';
import { raceAppearance } from '../src/data';
import { sexeSchema } from '../src/data/schemas/grammaire/valeurs';
import { tenueLabel } from '../src/gameIso/rig/parts/career';
import { assertWardrobeId } from './_lib-wardrobe';

// `RigSprite.career` se résout par ID de garde-robe (carrière ∪ classe ∪ tenue) : la galerie
// n'écrit que des ids, et VALIDE fail-fast — un id qui retombe sur « nu » est une faute
// d'authoring, jamais un corps nu silencieux (#1338, patron #1326).
const TENUES_QC = ['garde', 'noble', 'repurgateur', 'tueur', 'medecin', 'voleur', 'flagellant', 'sorcier', 'chevalier', 'mendiant', 'nonne', 'batelier'];
for (const id of [...TENUES_QC, 'soldat'])
  assertWardrobeId(id, 'rig-gallery');

// Espèces de la planche : le registre `raceAppearance.json` fait foi (les races qui portent une
// apparence de rig authorée). `label` ne sert que de légende.
const SPECIES = raceAppearance.map((r) => ({ id: asRigSpeciesId(r.id), label: r.label }));
const wep = (name: string, type: 'melee' | 'ranged'): Weapon => ({ label: name, type, damage: { plusBF: false, flat: 4 }, qualities: [] } as Weapon);
const plate: ItemInstance = { uid: '1', label: 'Plastron de plaque', kind: 'armor', qualities: [], pa: 4, locs: ['corps'], enc: 1, equipped: true };
const helm: ItemInstance = { uid: '2', label: 'Heaume', kind: 'armor', qualities: [], pa: 2, locs: ['tete'], enc: 1, equipped: true };

function cell(label: string, app: Appearance, equip: EquipCtx, career: string, view: 'front' | 'back' | 'profile' = 'front') {
  const svg = renderToStaticMarkup(
    React.createElement('svg', { viewBox: '0 0 120 150', width: 110, height: 138 },
      React.createElement('defs', { dangerouslySetInnerHTML: { __html: defsGlobaux() } }),
      React.createElement('rect', { x: 0, y: 0, width: 120, height: 150, fill: '#1d2230' }),
      React.createElement(RigSprite, { appearance: app, equip, career, view }),
    ),
  );
  return `<figure style="margin:0;text-align:center"><div>${svg}</div><figcaption style="color:#cdd;font:11px sans-serif">${label}</figcaption></figure>`;
}

const cells: string[] = [];
for (const sp of SPECIES) {
  for (const sex of sexeSchema.options) {
    cells.push(cell(`${sp.label} ${sex}`, { species: sp.id, sex, build: 0.5, seed: 7 }, { weapons: [], armour: [] }, 'soldat'));
  }
}
// variantes d'équipement (Humain M)
cells.push(cell('Humain M + épée', { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: 3 }, { weapons: [wep('Épée', 'melee')], armour: [] }, 'soldat'));
cells.push(cell('Humain M + hache+bouclier', { species: asRigSpeciesId('humain'), sex: 'M', build: 0.6, seed: 3 }, { weapons: [wep('Hache', 'melee')], armour: [], shield: { name: 'Bouclier', qualities: ['Bouclier'] } as unknown as Weapon }, 'soldat'));
cells.push(cell('Humain M + plaque+heaume', { species: asRigSpeciesId('humain'), sex: 'M', build: 0.6, seed: 3 }, { weapons: [wep('Épée', 'melee')], armour: [plate, helm] }, 'soldat'));
cells.push(cell('Humain F Sorcier + bâton', { species: asRigSpeciesId('humain'), sex: 'F', build: 0.4, seed: 5 }, { weapons: [wep('Bâton', 'melee')], armour: [] }, 'sorcier'));
cells.push(cell('Nain M + hache', { species: asRigSpeciesId('nain'), sex: 'M', build: 0.7, seed: 9 }, { weapons: [wep('Hache', 'melee')], armour: [] }, 'soldat'));

// Facing : Soldat humain en 3 vues (front/back/profile) — tranche verticale.
for (const view of ['front', 'back', 'profile'] as const) {
  cells.push(cell(`Soldat ${view}`, { species: asRigSpeciesId('humain'), sex: 'M', build: 0.55, seed: 4 }, { weapons: [wep('Épée', 'melee')], armour: [] }, 'soldat', view));
}

// Tenues par carrière (sans équipement → la tenue de la carrière s'affiche). Ids de garde-robe ;
// le libellé ne sert que de légende (`tenueLabel`).
for (const car of TENUES_QC) {
  cells.push(cell(tenueLabel(car), { species: asRigSpeciesId('humain'), sex: 'M', build: 0.55, seed: 4 }, { weapons: [], armour: [] }, car));
}

// F1 : ennemis humanoïdes riggés (classifieur + dérivation). Arme + tenue + mutations.
import { enemyRigProfile, entityRigProfile } from '../src/gameIso/rig/enemyProfile';
import { AMBIENT_CLIPS } from '../src/gameIso/rig/anim/ambientClips';
import type { Combatant } from '../src/engine/types';
function enemyCell(name: string, view: 'front' | 'back' | 'profile' = 'front') {
  const c = {
    id: `gal-${name}`, label: name, kind: 'enemy',
    characteristics: {} as Combatant['characteristics'], wounds: { current: 10, max: 10 },
    advantage: 0, conditions: [],
    weapons: [{ label: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }],
    armour: { tete: 2, brasG: 0, brasD: 0, corps: 4, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4,
  } as Combatant;
  const p = enemyRigProfile(c);
  if (!p) return cell(`${name} (sprite)`, { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5 }, { weapons: [], armour: [] }, 'soldat', view);
  const svg = renderToStaticMarkup(
    React.createElement('svg', { viewBox: '0 0 120 150', width: 110, height: 138 },
      React.createElement('defs', { dangerouslySetInnerHTML: { __html: defsGlobaux() } }),
      React.createElement('rect', { x: 0, y: 0, width: 120, height: 150, fill: '#2a1d22' }),
      React.createElement(RigSprite, { appearance: p.appearance, equip: p.equip, career: p.tenue, overlays: [], view }),
    ),
  );
  const label = view === 'front' ? name : `${name} ${view}`;
  return `<figure style="margin:0;text-align:center"><div>${svg}</div><figcaption style="color:#e9b;font:11px sans-serif">${label}</figcaption></figure>`;
}
for (const e of ['Bandit', 'Cultiste', 'Soldat', 'Garde', 'Flagellant', 'Noble', 'Répurgateur', 'Sorcier', 'Nain mercenaire', 'Voleur']) {
  cells.push(enemyCell(e));
}
// Mutant : 3 vues + montre les calques de mutation.
for (const v of ['front', 'back', 'profile'] as const) cells.push(enemyCell('Mutant', v));
cells.push(enemyCell('Guerrier du Chaos'));

// I : poses d'ambiance (1re keyframe du clip en boucle) — démo mutant qui dévore.
function ambientCell(name: string, animKey: string, label: string) {
  const p = entityRigProfile(name, 4);
  if (!p) return '';
  const pose = AMBIENT_CLIPS[animKey].steps[0].pose;
  const svg = renderToStaticMarkup(
    React.createElement('svg', { viewBox: '0 0 120 150', width: 110, height: 138 },
      React.createElement('defs', { dangerouslySetInnerHTML: { __html: defsGlobaux() } }),
      React.createElement('rect', { x: 0, y: 0, width: 120, height: 150, fill: '#22291d' }),
      React.createElement(RigSprite, { appearance: p.appearance, equip: p.equip, career: p.tenue, overlays: [], pose }),
    ),
  );
  return `<figure style="margin:0;text-align:center"><div>${svg}</div><figcaption style="color:#be9;font:11px sans-serif">${label}</figcaption></figure>`;
}
cells.push(ambientCell('Mutant', 'feeding', 'Mutant dévore'));
cells.push(ambientCell('Villageois', 'praying', 'Villageois prie'));
cells.push(ambientCell('Cultiste', 'cowering', 'Cultiste terrorisé'));

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Rig QC</title></head>
<body style="background:#11141c;padding:16px">
<h1 style="color:#eee;font:18px sans-serif">Galerie QC du rig — espèces × sexe + équipement</h1>
<div style="display:grid;grid-template-columns:repeat(auto-fill,120px);gap:14px">${cells.join('')}</div>
</body></html>`;

writeFileSync('public/rig-gallery.html', html);

// Échantillons .svg autonomes (pour inspection directe).
function standalone(app: Appearance, equip: EquipCtx, career: string) {
  return renderToStaticMarkup(
    React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 120 150', width: 240, height: 300 },
      React.createElement('defs', { dangerouslySetInnerHTML: { __html: defsGlobaux() } }),
      React.createElement('rect', { x: 0, y: 0, width: 120, height: 150, fill: '#2a3142' }),
      React.createElement(RigSprite, { appearance: app, equip, career }),
    ),
  );
}
writeFileSync('public/rig-sample-humain.svg', standalone({ species: asRigSpeciesId('humain'), sex: 'M', build: 0.55, seed: 3 }, { weapons: [wep('Épée', 'melee')], armour: [], shield: { name: 'Bouclier', qualities: ['Bouclier'] } as unknown as Weapon }, 'soldat'));
writeFileSync('public/rig-sample-nain.svg', standalone({ species: asRigSpeciesId('nain'), sex: 'M', build: 0.7, seed: 9 }, { weapons: [wep('Hache', 'melee')], armour: [] }, 'soldat'));
console.log(`OK: public/rig-gallery.html (${cells.length} cellules) + 2 svg autonomes`);
