/**
 * Gabarit VÉHICULE TERRESTRE (EDOC 07 « Chargement ») — attelage/chariot INERTE : caisse bâchée + roues
 * + timon, rendu par le système de plans (comme la coque de navire et l'engin de siège), une silhouette
 * recoloriée par la palette à jetons, ANCRÉE BASE-AU-SOL via `groundedBody`.
 *
 * Routé par `hull.propulsion === 'terrestre'` dans `bodyPlan` (JAMAIS par la coque de navire : une
 * diligence/charrette ne peut plus retomber par accident sur le gabarit `navire`). L'art de chaque
 * véhicule est 1 fichier `land/defs/<id>.ts` (registre auto-chargé `LAND_ARTS`, MÊME pattern que les
 * engins de siège) ; le TYPE de véhicule (`species`, id de `vehicles.json`) sélectionne l'art PAR ID via
 * `ART_BY_ID` — JAMAIS de name-matcher/regex. Un id FUTUR sans art dédié tombe sur le REPLI VISIBLE
 * partagé (#223, `orientedArtOr`), jamais sur un générique silencieux. Silhouettes de BROADSIDE : la
 * couverture réelle est DÉCLARÉE (galerie QC) ; face/dos REPLIENT via `nearestView`/`foldView`.
 */
import { rotOf, type BonePose } from '../poses';
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette } from '../palette';
import { groundedBody } from '../staticBody';
import { nearestView, orientedArtOr, type ViewArt } from '../viewArt';
import { LAND_DEFAULT } from './artkit';
import { LAND_ARTS } from './_registry.generated';
import { terrestreSpeciesNames } from '../creatures';

/** Index des arts par id de véhicule (registre `land/defs/`, auto-chargé). Un id sans art propre tombe
 *  sur le REPLI VISIBLE (#223) — MÊME mécanique que `ENGIN_ARTS`/`SHIP_ARTS`. */
const ART_BY_ID = new Map(LAND_ARTS.map((a) => [a.id, a]));

/** Art orienté d'un type de véhicule terrestre ; repli VISIBLE (#223) si l'id n'a pas d'art dédié.
 *  Exposé pour la galerie QC. */
export function landArtOf(species: string): ViewArt {
  return orientedArtOr(ART_BY_ID, species, 'terrestre');
}

function art(species: string, view: View): string {
  // Sélection vue + repli PARTAGÉS (`nearestView`), jamais un ternaire ad hoc par vue.
  return nearestView(landArtOf(species), view)();
}

/** (espèce, vue, pose, couleurs) → un os statique ancré au sol. `pose.cahot` = tangage de roulage /
 *  renversement (mort). */
function resolveLand(species: string, view: View, pose: BonePose = {}, colors?: Palette): ResolvedBone[] {
  return groundedBody(art(species, view), LAND_DEFAULT, colors, { id: 'chariot', tilt: rotOf(pose, 'cahot') });
}

export const landPlan: BodyPlan = {
  id: 'terrestre',
  resolve: (sp, view, pose, opts) => resolveLand(sp, view, pose, opts?.colors),
  speciesNames: terrestreSpeciesNames, // dérivé du registre (defs `plan: 'terrestre'`) — 0 def à ce jour (#1570), une def entrante est prise sans geste
  // Ancré au sol (bas de la boîte) → le portrait cadre ce bas, comme l'engin (sinon disque vide).
  portraitBox: '25 80 70 70',
  restPose: () => ({}),
  walkPose: (phase) => ({ cahot: Math.sin(phase * Math.PI * 2) * 1.6 }), // léger cahot en roulant
  idlePose: (phase) => ({ cahot: Math.sin(phase * Math.PI * 2) * 0.5 }),
  attackPose: () => ({}), // un chariot n'attaque pas
  deathPose: () => ({ cahot: 20 }), // versé/roue cassée
  hasView: () => true,
};
