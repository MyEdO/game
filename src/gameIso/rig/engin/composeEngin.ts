/**
 * Gabarit ENGIN DE SIÈGE (ADE II 8 « Le théâtre de la guerre ») — pièce d'artillerie INERTE servie
 * par un équipage, rendue par le système de plans (comme la coque de navire) : une silhouette statique
 * recoloriée par la palette à jetons, ANCRÉE BASE-AU-SOL via `groundedBody` (pas de lévitation).
 *
 * RÉUTILISE entièrement `staticBody` (ancrage + palette) — aucune machinerie nouvelle. L'art de chaque
 * engin est 1 fichier `engin/defs/<id>.ts` (registre auto-chargé `ENGIN_ARTS`, MÊME pattern que les
 * armes/créatures) ; le TYPE d'engin (`species`, id de la def) sélectionne l'art PAR ID via `ART_BY_ID`
 * — JAMAIS de name-matcher/regex (règle de rendu : « espèce explicite → record »). Les 3 vues (face /
 * profil / dos) sont des arts dédiés en coords LOCALES (origine = contact sol au centre, y NÉGATIF vers le haut).
 */
import { rotOf, type BonePose } from '../poses';
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette } from '../palette';
import { groundedBody } from '../staticBody';
import { nearestView, orientedArtOr, type ViewArt } from '../viewArt';
import { ENGIN_DEFAULT } from './artkit';
import { ENGIN_ARTS } from './_registry.generated';
import { enginSpeciesNames } from '../creatures';

/** Index des arts par id d'espèce (registre `engin/defs/`, 13 defs). Les 13 `siegeRig` de `trappings.json`
 *  ont TOUS leur art dédié ICI **et** leur `CreatureDef` de plan `engin` dans `creatures/defs/` (#1536) —
 *  sans quoi `bodyPlan` rendrait l'affût en humanoïde. `canon-petit` est un ART RÉEL (canon de rempart,
 *  pointé par la donnée), plus un repli. Un id FUTUR sans art tombe sur le REPLI VISIBLE partagé (#223) — MÊME mécanique que
 *  `SHIP_ARTS`/`LAND_ARTS`. */
const ART_BY_ID = new Map(ENGIN_ARTS.map((a) => [a.id, a]));

/** Art orienté d'un type d'engin ; repli VISIBLE (#223) si l'id n'a pas d'art dédié. Exposé pour la galerie QC. */
export function enginArtOf(species: string): ViewArt {
  return orientedArtOr(ART_BY_ID, species, 'engin');
}

function art(species: string, view: View): string {
  // Sélection vue + repli PARTAGÉS (`nearestView`), jamais un ternaire ad hoc par vue.
  return nearestView(enginArtOf(species), view)();
}

/** (espèce, vue, pose, couleurs) → un os statique ancré au sol. `pose.recul` = recul (tir) / bascule (mort). */
function resolveEngin(species: string, view: View, pose: BonePose = {}, colors?: Palette): ResolvedBone[] {
  return groundedBody(art(species, view), ENGIN_DEFAULT, colors, { id: 'engin', tilt: rotOf(pose, 'recul') });
}

export const enginPlan: BodyPlan = {
  id: 'engin',
  resolve: (sp, view, pose, opts) => resolveEngin(sp, view, pose, opts?.colors),
  speciesNames: enginSpeciesNames, // dérivé du registre de créatures (defs `plan: 'engin'`), comme quad/ailé/bipède
  // L'engin est ANCRÉ AU SOL (bas de la boîte) → le portrait cadre ce bas (x centré, y 80→150), sinon le
  // cadre haut-avant générique ne montrerait que du vide (disque noir).
  portraitBox: '25 80 70 70',
  restPose: () => ({}),
  walkPose: () => ({}), // un engin ne marche pas (servi sur place)
  attackPose: (phase) => ({ recul: -Math.sin(Math.min(1, phase) * Math.PI) * 5 }), // léger recul au tir
  deathPose: () => ({ recul: 16 }), // affût démonté/basculé
  hasView: () => true,
};
