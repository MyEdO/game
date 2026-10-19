/**
 * MANŒUVRE NAVALE jouable (MDG 13 « Navigation maritime ») — couche STATE (dépend du cap/grille, comme
 * `fireArc`/`shipPostes` ; le moteur reste pur). Le « Personnage à la barre » jette un Test de Navigation —
 * **Voile** si le navire avance à la voile, **Ramer** s'il avance aux avirons — modifié par le **Man** du
 * navire (`resolveShipManeuver`, moteur pur). Sur réussite du Test qui le porte (`ManeuverResult.success`), le
 * navire VIRE de `turnSteps` crans (`shipTurn` re-mappe d'un coup ses arcs de bordée) ; il avance TOUJOURS le
 * long du cap (`shipAdvance`).
 *
 * SÉPARATION jet ⟂ application (patron des flux différés, cf. `run`) : `rollShipManeuver` résout le Test
 * (RNG, AUCUNE mutation) → `ManeuverResult` ; `applyShipManeuver` exécute le virage + l'avance (mutation).
 * `maneuverShip` (IA navale, devtools, tests) compose jet+application.
 *
 * Le M (Mouvement) et le Man du navire vivent dans `vehicles.json` (facette `ship`), PAS sur le Combattant-coque
 * (`vehicleCombatant` met `movement:0`) → on les relit via `creatureId` (`shipManeuverParams`).
 */
import { battleRng } from '../noyau/battleRng';
import { rollTest, evaluateTest, easeDifficulty, bestForcedRoll, ECHEC_SANS_JET, ligneSansJet, type EchecSansJet } from '../engine/tests';
import { rollLine } from '../noyau/rollSeam';
import { testValue, partyBest, peutTenter, refusNePeutTenter, refusPersonneNePeutTenter } from '../engine/skills';
import { resolveShipManeuver, type ShipManeuverOutcome } from '../engine/shipNavigation';
import { navalMoveMod, navalMoveMult, navalSkillTestDR, navalTestTypeDR, navalNavTestDR, hullNavalTraits } from '../engine/navalTraits';
import { cargoOverload } from '../engine/seaVoyage';
import { exposedCrew } from '../engine/shipCritical';
import { crewRoleValue, crewRoleTestMods, crewTalentDR, moraleBand, capToSuccesMinime, crewTestSuccess } from '../engine/crewMorale';
import { placementPenalty } from './shipPostes';
import { inBattleId } from '../noyau/monde/combatants';
import { garanti } from '../lib/garanti';
import { t } from '../i18n';
import { findCrewRoleById } from '../data';
import { profilNavalDe } from '../engine/coque';
import { propulsionDuNavire, milieuDuVoyage, type MilieuDeNavigation } from '../engine/shipBuild';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import type { RNG } from '../engine/dice';
import type { Combatant } from '../engine/types';
import type { PairedSense } from '../engine/ops';
import type { Get } from './flowTypes';
import type { PlayerText } from '../i18n/playerText';

import type { CrewRoleRoll } from '../noyau/pendings'; // défini côté pendings (neutre) — cf. quarantaine #328
export type { CrewRoleRoll };

/** Jet d'UN contributeur à son rôle : Test de la compétence du rôle (MDG 14). PUR (RNG injecté). Rend la LIGNE
 *  de la rangée — le jet, ou `ligneSansJet` avec le refus nommé (LDB 09 l.30 ; #2588 Q1). `null` si le
 *  rôle est inconnu. La valeur suit `crewRoleValue` (meilleure compétence du rôle pour ce marin) ; sur un jet
 *  RÉUSSI s'ajoute le +DR de Talent en contexte Test d'équipage (`crewTalentDR` — Commandant émérite, MDG 09 l.54).
 *  `sense` (optionnel) : sens narratif du Test précis (Vigie du phare, MDG 13 l.337) — transmis à `crewRoleValue`. */
export function rollCrewRole(crew: Combatant, roleId: string, navigation: RefDesignee, rng: RNG, cumul = false, sense?: PairedSense): { result: CrewRoleRoll; refus?: PlayerText } | null {
  const role = findCrewRoleById(roleId);
  if (!role) return null;
  const rv = crewRoleValue(crew, role, navigation, sense);
  if (rv.refus != null) return ligneSansJet(rv.refus);
  // Cumul de 2 rôles (un marin déjà engagé dans un autre Test d'équipage ce Round) → +2 crans de Difficulté
  // (Manque de bras, MDG 14 l.53).
  const surCible = crewRoleTestMods(crew, role, navigation, sense).reduce((s, m) => s + m.value, 0);
  const t = rollTest(rv.value, cumul ? easeDifficulty('intermediaire', -2) : 'intermediaire', rng, surCible);
  return { result: { roll: t.roll, target: t.target, sl: t.sl + (t.success ? crewTalentDR(crew, role, navigation) : 0) } };
}

/** Résilience « Je ne faillirai pas ! » pour UN contributeur (PJ) : DR MAXIMAL à son rôle (LDB 17 l.68). PUR. */
export function forceCrewRole(crew: Combatant, roleId: string, navigation: RefDesignee, cumul = false, sense?: PairedSense): Exclude<CrewRoleRoll, EchecSansJet> | null {
  const role = findCrewRoleById(roleId);
  if (!role) return null;
  const rv = crewRoleValue(crew, role, navigation, sense);
  if (rv.refus != null) return null; // aucun jet à forcer — LDB 17 l.68, LDB 09 l.30
  // Résilience à DR max ; cible abaissée de +2 crans si cumul (Manque de bras, l.53). Le dé forcé est
  // POLICY-AWARE (`bestForcedRoll` : standard → 01 = DR max ; Fast DR → dé le plus haut, LDB 12 l.102) —
  // un 01 en dur DONNERAIT DR 0 en Fast DR (dizaines du jet). `crewTalentDR` (Commandant émérite, MDG 09 l.54)
  // PRÉSERVÉ, ajouté au DR (jamais double-compté).
  // La cible passe par le MONTEUR, donc par `clampTarget` — le MÊME écrêtage que `rollTest` applique
  // au jumeau qui roule (`rollCrewRole`, ci-dessus). Effet MESURÉ aux bornes seulement : une valeur
  // de rôle à 110 forçait un DR 11 et rend désormais DR 9 (cible 99). Alignement VOULU : les deux
  // voies d'un même Test — roulé et forcé par Résilience — ne peuvent pas jetter sur deux cibles.
  const target = rollLine({
    actor: crew, difficulty: cumul ? easeDifficulty('intermediaire', -2) : 'intermediaire',
    valeur: rv.value, surLaCible: crewRoleTestMods(crew, role, navigation, sense),
  }).target;
  const die = bestForcedRoll(target);
  return { roll: die, target, sl: evaluateTest(die, target).sl + crewTalentDR(crew, role, navigation) };
}

/** Total du Test d'équipage de MANŒUVRE (MDG 14 l.13) : Σ des DR des contributeurs, le rôle ESSENTIEL compté
 *  DOUBLE (l.19), + la bande de Moral (l.13 « bonus/pénalités… en masse »), + le **Manque de bras** global
 *  (`undercrew` : −2 DR/tranche de 10 % manquant + plafond Succès Minime, l.55), + `extraDR` (SABOTAGE,
 *  l.45-47 : −1..−5 DR imposés au Test d'équipage). Ce total tient lieu de DR de
 *  Navigation que la manœuvre (ch.13) module ensuite par le Man du navire. PUR — pending MULTI de COMBAT
 *  (`ShipManeuverParticipant[]`, `roleId` matché à `essentialRoleId`, RollShell). Le même « essentiel ×2 »
 *  (l.19) est ré-implémenté sur une forme DISTINCTE par `aggregateBatchRolls` (`cascade.ts`, `BatchParticipant[]`
 *  + flag `essential` — Cascade `CascadeStep.participants`) : NON convergentes VOLONTAIREMENT, deux pendings
 *  de forme différente (#351). */
export function maneuverCrewTotal(
  participants: { roleId: string; result: CrewRoleRoll | null }[],
  essentialRoleId: string | undefined,
  moraleScore: number,
  undercrew?: { dr: number; capSuccesMinime: boolean },
  extraDR = 0,
): number {
  let base = 0;
  for (const p of participants) {
    if (!p.result) continue;
    base += essentialRoleId && p.roleId === essentialRoleId ? p.result.sl * 2 : p.result.sl;
  }
  let total = base + moraleBand(moraleScore).crewTestDR + (undercrew?.dr ?? 0) + extraDR;
  if (undercrew?.capSuccesMinime) total = capToSuccesMinime(total); // jamais mieux qu'un Succès Minime (l.55)
  return total;
}

/** `ManeuverResult` d'un Test d'ÉQUIPAGE : le total d'équipage tient lieu de DR de Navigation ; `success` =
 *  `crewTestSuccess` du DR final, Man compris (MDG 14 l.13, l.76). Le déplacement suit la Progression. PUR. */
export function deriveManeuverFromCrew(ship: Combatant, crewTotal: number, milieu: MilieuDeNavigation): ManeuverResult {
  const { baseM, manoeuvre, extraDR } = shipManeuverParams(ship, milieu);
  const out = resolveShipManeuver(crewTotal, baseM, manoeuvre, extraDR);
  return { ...out, success: crewTestSuccess(out.dr), navDR: crewTotal, advanced: 0 };
}

/** Le barreur : parmi l'équipage présent (`exposedCrew` : vivant, Blessures > 0) qui peut tenter le Test
 *  (`peutTenter`, lu par `partyBest` — un Inconscient ne tient pas la barre, LDB 16 l.113), celui qui a la
 *  MEILLEURE valeur de Test de `skillId` (Voile/Ramer). */
function bestHelmsman(crew: Combatant[], competence: RefDesignee): Combatant | undefined {
  // Argmax sur l'axe ACTEUR (`partyBest` = maxBy sur `testValue`) : first-max strict, identique au tri desc stable
  // qui rendait le PREMIER max en `[0]`.
  return partyBest(exposedCrew(crew), competence.id, undefined, undefined, competence.spec)?.actor;
}

export interface ManeuverResult extends ShipManeuverOutcome {
  /** Issue du virage = issue du Test qui le porte : Test individuel (LDB 12 l.11), Test d'équipage
   *  (MDG 14 l.13, l.76). */
  success: boolean;
  /** DR du Test de Navigation du barreur (avant ajout du Man — `dr` final = `navDR` + Man + extra). */
  navDR: number;
  /** d100 du Test de Navigation (affichage de la RollLine). Synthétique (≈1) si réussite forcée. */
  roll?: number;
  /** Valeur cible du Test de Navigation (affichage). */
  target?: number;
  /** Nom du barreur (journal). */
  helmsman?: string;
  /** Refus NOMMÉ d'une barre que personne ne peut tenir (LDB 09 l.30 ; #2588 Q1) : le Test n'a pas roulé. */
  refus?: PlayerText;
  /** Cases réellement parcourues par la coque (rempli à l'application, sinon 0). */
  advanced: number;
}

/** Paramètres de Manœuvre d'un navire, lus en DONNÉE (facette `ship` de `vehicles.json` + Traits/Améliorations
 *  + répartition des pièces). PUR — `M`/`Man`/`extraDR` EFFECTIFS (Lissage, Peu maniable, déséquilibre des bords).
 *  `extraDR` NE PORTE PAS le `skillDRBonus` ciblé `testType:"manoeuvre"` (#221) — SOURCE UNIQUE de son addition :
 *  `openCrewTestPending` (combatSlice.ts, testTypeId='manoeuvre') pour le Test d'équipage ; `maneuverTestTypeDR`
 *  ci-dessous pour le barreur SOLO (`deriveManeuver`, hors Test d'équipage) — jamais les deux à la fois. */
export interface ManeuverParams {
  baseM: number;
  manoeuvre: number;
  extraDR: number;
  competence: RefDesignee;
}
/** `skillDRBonus` ciblé `testType:"manoeuvre"` (#221) — consommé UNIQUEMENT par `deriveManeuver` (barreur solo,
 *  hors Test d'équipage) ; le Test d'équipage l'obtient déjà via `openCrewTestPending`. PUR. */
function maneuverTestTypeDR(ship: Combatant): number {
  return navalTestTypeDR(hullNavalTraits(ship), 'manoeuvre');
}
export function shipManeuverParams(ship: Combatant, milieu: MilieuDeNavigation): ManeuverParams {
  const vd = profilNavalDe(ship);
  const { m: baseM, competence } = garanti(propulsionDuNavire(ship.creatureId, ship.upgrades, milieu), ship.creatureId, 'propulsion du navire');
  // Répartition des pièces (MDG 12 l.432-433) : un bord surchargé pénalise −1/−2 M, Man ET DR de Navigation
  // (trois colonnes RAW DISTINCTES → cumulées). Sans Contenance connue → aucune pénalité.
  const place = vd?.capacity
    ? placementPenalty((ship.postes ?? []).flatMap((p) => (p.side ? [{ side: p.side, weight: p.item.enc }] : [])), vd.capacity)
    : { m: 0, man: 0, navDR: 0 };
  // SURCHARGE de la cale (MDG 12 l.70-75, DISTINCT du déséquilibre de bord) : −1/−2/−3 M ET DR Manœuvre par
  // palier d'Encombrement supplémentaire (`ship.cargoEnc` recopié de `CampaignVessel.cargo`). Cumulée aux autres.
  const overload = vd?.capacity ? cargoOverload(ship.cargoEnc ?? 0, vd.capacity) : null;
  // « Lissage » → op `moveMod` (M +1, l.293) ; « Peu maniable » → op `skillDRBonus` (Voile/Ramer, −1/niveau,
  // l.173, DISTINCT du Man) — lus en GameOp (`naval-traits.json`, langue unique) sur Traits+Améliorations.
  // #221 : op `skillDRBonus` ciblée par `testType` (ex. « manoeuvre ») — agnostique de skillId, cumulée.
  // « Coque de course » → op `moveScale` (2×M, MSRC 12 l.27) : facteur MULTIPLICATIF appliqué APRÈS les
  // `moveMod` additifs (ordre canonique d'`effectiveMovement`). Le M de VOYAGE (route.speed/travelSpeed) suit un
  // autre modèle et n'en dépend pas — le 2× ne joue qu'ici, où le M du navire pilote la manœuvre tactique.
  const navalTraits = hullNavalTraits(ship);
  const mult = navalMoveMult(navalTraits);
  return {
    baseM: Math.round(((baseM + navalMoveMod(navalTraits) + place.m + (overload?.mMod ?? 0)) * mult.num) / mult.den),
    manoeuvre: (vd?.manoeuvre ?? 0) + place.man + (overload?.manoeuvreDR ?? 0),
    // « Bouteur » (MSRC 12 l.66) → +20 au Test de Navigation pour diriger ; « Gréement de course » (l.137)
    // → −10. Converti en DR d'équipage (`navalNavTestDR`, ÷10) — injecté ICI UNE fois (deriveManeuver/FromCrew),
    // jamais dans openCrewTestPending, pour ne pas double-compter.
    extraDR: navalSkillTestDR(navalTraits, competence.id) + navalNavTestDR(navalTraits) + place.navDR,
    competence,
  };
}

/** `ManeuverResult` du Test de Navigation d'un barreur SOLO (PUR, aucune mutation, aucun RNG) : `success`
 *  = `nav.success` (LDB 12 l.11) ; le Man entre au DR (MDG 13 l.119 ; MDG 12 l.50). */
function deriveManeuver(params: ManeuverParams, ship: Combatant, nav: { sl: number; roll: number; target: number; success: boolean }, helmsman: string): ManeuverResult {
  const { baseM, manoeuvre, extraDR } = params;
  const out = resolveShipManeuver(nav.sl, baseM, manoeuvre, extraDR + maneuverTestTypeDR(ship)); // barreur SOLO, hors Test d'équipage
  return { ...out, success: nav.success, navDR: nav.sl, roll: nav.roll, target: nav.target, helmsman, advanced: 0 };
}

/** Barre que personne ne peut tenir : aucun Test, donc rien que Man ni les modificateurs du Test ne
 *  modifient (MDG 12 l.50, MDG 13 l.119). La Progression (MDG 13 l.68-75) se lit au DR d'`ECHEC_SANS_JET`.
 *  `helmsman` : le barreur IMPOSÉ qui ne peut pas tenter, nommé au journal. LDB 09 l.30 ; #2588 Q1. */
function maneuverSansJet(params: ManeuverParams, refus: PlayerText, helmsman?: string): ManeuverResult {
  const out = resolveShipManeuver(ECHEC_SANS_JET.sl, params.baseM, 0);
  return { ...out, success: ECHEC_SANS_JET.success, navDR: ECHEC_SANS_JET.sl, ...(helmsman != null ? { helmsman } : {}), refus, advanced: 0 };
}

/**
 * Jet du Test de Navigation du barreur (RNG de combat) → `ManeuverResult`. `helmsmanId` force le barreur,
 * sinon le meilleur de l'équipage APTE en Voile/Ramer. **PUR** (ne mute rien : ni virage, ni avance, ni log).
 * `null` hors combat / navire introuvable. La direction (`turnSteps`) est ORTHOGONALE au jet (appliquée au confirm).
 */
export function rollShipManeuver(get: Get, shipId: string, helmsmanId?: string): ManeuverResult | null {
  const battle = get().battle;
  const ship = inBattleId(battle, shipId);
  if (!battle || !ship) return null;
  const params = shipManeuverParams(ship, milieuDuVoyage(get().travelPlan));
  const { id: skillId, spec } = params.competence;
  const crew = (ship.crewIds ?? [])
    .map((id) => inBattleId(battle, id))
    .filter((c): c is Combatant => !!c);
  const imposed = helmsmanId ? inBattleId(battle, helmsmanId) : undefined;
  const helm = helmsmanId ? (imposed && peutTenter(imposed, skillId, spec) ? imposed : undefined) : bestHelmsman(crew, params.competence);
  // LDB 09 l.30, MSRC 7 l.17 ; #2588 Q1.
  if (!helm) return imposed ? maneuverSansJet(params, refusNePeutTenter(imposed, { skill: skillId, spec }), imposed.label) : maneuverSansJet(params, refusPersonneNePeutTenter({ skill: skillId, spec }));
  return deriveManeuver(params, ship, rollTest(testValue(helm, skillId, undefined, spec), 'intermediaire', battleRng()), helm.label);
}

/**
 * APPLIQUE une manœuvre résolue (mutation) : sur réussite, vire de `turnSteps` crans (`shipTurn` re-mappe les
 * arcs) ; le navire avance TOUJOURS le long du cap (`shipAdvance`, MDG 13 — déplacement INCONDITIONNEL,
 * M÷2 plancher). Renvoie les cases avancées. Logue le succès (via `shipTurn`) ou l'échec.
 */
export function applyShipManeuver(get: Get, shipId: string, result: ManeuverResult, turnSteps: number): number {
  const ship = inBattleId(get().battle, shipId);
  if (result.success) get().shipTurn(shipId, turnSteps); // vire + re-mappe les arcs + logue le nouveau cap
  else {
    if (result.refus != null) get().log(result.refus);
    get().log(t('shipManv.failLine', { helmsman: result.helmsman ?? t('shipManv.crewFallback'), ship: ship?.label ?? shipId, dr: result.dr }));
  }
  return get().shipAdvance(shipId, result.movement);
}

/**
 * Manœuvre COMPOSÉE (jet + application) — `helmsmanId` force le barreur. Utilisée par les devtools `__wfrp`
 * et les tests headless ; le flux différé jouable (modale) appelle `rollShipManeuver`/`applyShipManeuver`
 * séparément. `null` hors combat.
 */
export function maneuverShip(get: Get, shipId: string, turnSteps: number, helmsmanId?: string): ManeuverResult | null {
  const r = rollShipManeuver(get, shipId, helmsmanId);
  if (!r) return null;
  const advanced = applyShipManeuver(get, shipId, r, turnSteps);
  return { ...r, advanced };
}
