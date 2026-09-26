/**
 * Gabarit NAVIRE / VÉHICULE À COQUE (MDG 12) — rendu par le système de plans : une coque ANCRÉE AU
 * SOL (la quille repose sur l'eau/la case, cf. `groundedBody`) qui roule au repos et gîte à la mort.
 * RÉUTILISE entièrement la fondation `groundedBody`/palette à jetons + le contrat d'art orienté partagé.
 *
 * L'art de chaque coque est 1 fichier `ship/defs/<id>.ts` (registre auto-chargé `SHIP_ARTS`, MÊME
 * pattern que les engins de siège / véhicules terrestres) ; le TYPE de navire (`species`, id de
 * `vehicles.json`) sélectionne l'art PAR ID — JAMAIS de name-matcher/regex. Les 20 coques du catalogue
 * sont dessinées ; un id FUTUR sans art dédié tombe sur le REPLI VISIBLE partagé (#223, `orientedArtOr`),
 * jamais sur un générique silencieux. La teinte vient de la palette du record (`appearance.colors`) ;
 * `ship.lengthM` donne l'échelle au point d'appel.
 */
import { rotOf, type BonePose } from '../poses';
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, PaletteDeclaree } from '../palette';
import { groundedBody } from '../staticBody';
import { pickView, orientedArtOr, type ViewArt } from '../viewArt';
import { SHIP_ARTS } from './_registry.generated';
import { navireSpeciesNames } from '../creatures';
import type { ShipArtDef } from './artkit';

// Registre des arts de coque PAR ID de véhicule (`ship/defs/`, auto-chargé). Un id sans def tombe sur le
// REPLI VISIBLE (#223) via `orientedArtOr` — MÊME mécanique que ENGIN_ARTS / LAND_ARTS.
const HULL_ART_BY_ID = new Map<string, ShipArtDef>(SHIP_ARTS.map((a) => [a.id, a]));

/** Art ORIENTÉ d'une coque, routé par ID de véhicule ; repli VISIBLE (#223) si l'id n'a pas d'art dédié.
 *  Exposé pour la galerie QC. */
export function shipArtOf(id: string): ViewArt {
  return orientedArtOr(HULL_ART_BY_ID, id, 'navire');
}

// Palette par défaut : jetons NAVIRE propres au plan (bois de coque / toile / mât-rames / pavillon vif).
// Les nuances O/H se dérivent via `buildTokenMap`.
export const SHIP_DEFAULT: PaletteDeclaree = { coque: '#6b4a2b', voile: '#e8e0cc', mat: '#4a3320', pavillon: '#b03a2e' };

// Poses (delta additif sur l'angle de la coque) : roulis au repos, tangage à l'« attaque » (éperon),
// forte gîte à la mort (le navire sombre/chavire).
const SHIP_REST: Record<string, number> = {};
const shipRoll = (phase: number): Record<string, number> => ({ coque: Math.sin(phase * Math.PI * 2) * 2.5 });
const shipRam = (phase: number): Record<string, number> => ({ coque: Math.sin(Math.min(1, phase) * Math.PI) * 6 });
const SHIP_DEATH: Record<string, number> = { coque: 22 };

function resolveShip(species: string, view: View, pose: BonePose = {}, colors?: Palette): ResolvedBone[] {
  // La vue demandée est CONSOMMÉE via le contrat d'art orienté PARTAGÉ (`pickView`). `pose.coque` = angle
  // de roulis/gîte (deg) ⇒ `tilt` autour de la quille (au sol), via la fondation PARTAGÉE `groundedBody`.
  // Les defs sont dessinées quille à y=0 (origine = contact) ⇒ baseY 0.
  const svg = pickView(shipArtOf(species), view)();
  return groundedBody(svg, SHIP_DEFAULT, colors, { id: 'coque', baseY: 0, tilt: rotOf(pose, 'coque') });
}

export const shipPlan: BodyPlan = {
  id: 'navire',
  resolve: (sp, view, pose, opts) => resolveShip(sp, view, pose, opts?.colors),
  speciesNames: navireSpeciesNames, // dérivé du registre (defs `plan: 'navire'`) — 0 def à ce jour (#1570), une def entrante est prise sans geste
  restPose: () => SHIP_REST,
  idlePose: shipRoll,
  walkPose: shipRoll,
  attackPose: shipRam,
  deathPose: () => SHIP_DEATH,
  hasView: () => true,
  // Coque ANCRÉE AU SOL (`groundedBody`, base en y=GROUND_Y=150) — SANS ce cadre, le portrait retombe
  // sur le défaut `CREATURE_BOX` haut-avant (bodyPlan.ts) qui ne couvre QUE y∈[14,94] : la coque entière
  // (dessinée en y négatif depuis la base 150, donc bien plus bas) tombait hors cadre → portrait noir/vide
  // en frise d'initiative et fiche navire (#376 pt.3). Même bloc bas que engin/land (mêmes fondations).
  portraitBox: '25 80 70 70',
};
