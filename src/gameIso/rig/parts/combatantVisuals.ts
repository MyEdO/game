/**
 * Source UNIQUE des visuels dérivés de l'ÉTAT d'un Combatant — mutations (Corruption, LDB 19) et
 * traits, DÉCLARÉS EN DONNÉE (`appearance` sur la mutation / le `TraitData`), + amputations/prothèses
 * (LDB 18/73). Consommée par tous les chemins de rendu (pion combat/exploration, vue top, portrait
 * HUD, cavalier) : un nouveau visuel d'état se branche en DONNÉE (fragment `appearance`), pas ici.
 *
 * Le fragment = `Partial<EntityAppearance>` : `features` (clés du catalogue → calques + morpho),
 * `colors` (peau recolorée), `eyes` (clé d'œil). Les calques passent par le catalogue (`feat`), la
 * morpho/peau/œil par `combatantAppearance` — `resolveRig` est inchangé.
 */
import type { Combatant } from '../../../engine/types';
import type { EntityAppearance } from '../../../engine/authoringAppearance';
import type { RigOverlay } from '../bones';
import type { Appearance } from '../appearance';
import { feat as catalogFeatures, featureMorpho } from './elements';
import { eyesArtFromKeys } from './eyes';
import { injuryOverlaysFor, injuryAppearance } from './injuries';
import { traitOverlaysFor } from './traitVisuals';
import { findTraitById, findCreatureById } from '../../../data';
import { mutationById } from '../../../data/mutations';
import { liveMorphRef } from '../../../engine/polymorph';

/** Fragments d'apparence déclarés par l'état : mutations PHYSIQUES + traits porteurs d'un `appearance`.
 *  Source unique lue par les deux fonctions (calques via `features`, couleurs/yeux/morpho).
 *  L'apparence d'une mutation est résolue depuis le registre **par id** (source unique ; l'instance ne
 *  porte que son id), avec repli sur une éventuelle copie inline. */
function stateFragments(c: Combatant): EntityAppearance[] {
  const out: EntityAppearance[] = [];
  for (const m of c.mutations ?? []) {
    if (m.kind !== 'physique') continue;
    const app = mutationById(m.id)?.appearance ?? m.appearance;
    if (app) out.push(app);
  }
  for (const x of c.traits ?? []) {
    const td = findTraitById(x.id);
    if (td?.appearance) out.push(td.appearance);
  }
  return out;
}

const featureKeys = (frags: EntityAppearance[]): string[] => frags.flatMap((f) => f.features ?? []);

/** Calques d'état : difformités/traits déclarés (catalogue, clés `appearance.features`) +
 *  amputations/prothèses + traits de créature (auto-visuel du bestiaire). */
export function combatantOverlays(c: Combatant): RigOverlay[] {
  return [...catalogFeatures(...featureKeys(stateFragments(c))), ...injuryOverlaysFor(c), ...traitOverlaysFor(c)];
}

/** Apparence modifiée par l'état : couleurs/yeux des fragments + morpho CUMULÉE des difformités
 *  (carrure/jambes/visage retourné), puis blessures. Même référence si rien ne s'applique (stabilité). */
export function combatantAppearance(a: Appearance, c: Combatant): Appearance {
  // Métamorphose en cours (op `polymorph`, #17) : on rend l'apparence de la créature-cible le temps de
  // l'effet (espèce/tenue/monstre…), tout en gardant sexe/carrure/seed de base — restitué à l'expiration.
  const mref = liveMorphRef(c);
  if (mref) {
    const morphApp = findCreatureById(mref)?.appearance;
    if (morphApp) a = { ...a, ...(morphApp as Partial<Appearance>) };
  }
  const frags = stateFragments(c);
  let out = a;
  if (frags.length) {
    let colors = a.colors;
    let eyes = a.eyes;
    for (const f of frags) {
      if (f.colors) colors = { ...colors, ...f.colors }; // la difformité prime sur la couleur choisie
      if (f.eyes) { const art = eyesArtFromKeys(f.eyes); if (art) eyes = { ...eyes, ...art }; }
    }
    const m = featureMorpho(featureKeys(frags));
    if (colors !== a.colors || eyes !== a.eyes || m.dBuild || m.legsMult !== 1 || m.faceFlip) {
      out = { ...a };
      if (m.dBuild) out.build = Math.min(1, Math.max(0, a.build + m.dBuild));
      if (m.legsMult !== 1) out.legs = (a.legs ?? 1) * m.legsMult;
      if (colors !== a.colors) out.colors = colors;
      if (eyes !== a.eyes) out.eyes = eyes;
      if (m.faceFlip) out.faceFlip = true;
    }
  }
  return injuryAppearance(out, c);
}
