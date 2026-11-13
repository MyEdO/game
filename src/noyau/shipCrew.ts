/**
 * Dérivation ÉQUIPAGE → RÔLES pour un Test d'équipage (MDG 14) — couche STATE (lit l'équipage du navire + son
 * Moral de campagne). PUR (sauf `shipMoraleScore` qui lit le store). La pièce manquante : personne ne construisait le
 * `CrewAssignment[]` que `resolveBattery`/la manœuvre attendent. Partagé par TOUS les Tests d'équipage (manœuvre,
 * batterie, perception…) — un seul endroit assigne les marins aux postes.
 */
import type { Combatant } from '../engine/types';
import { refCouvre } from '../data/schemas/grammaire/ref';
import { crewRoleValue, competencesDuRole, moraleBand, moraleBase, undercrewPenalty, weeklyCrewWageBrass, recalcMorale, payChoiceCostBrass, payChoices, isPayChoice, isFreePayChoice, freePayChoiceId, recommendedPayChoiceId, type CrewAssignment, type UndercrewPenalty } from '../engine/crewMorale';
import { fromBrass, canAfford, formatMoney, type Money } from '../engine/money';
import { partyMoneyTotal, payFromGroup } from './bourseFlow';
import { cadenceAuto } from '../engine/cadence';
import { deMonde, type RNG } from '../engine/dice';
import type { BattleState, CampaignVessel, Jeu } from './etat';
import type { NightEntry } from './restFlow';
import type { PendingBase } from './rollFlowFactory';
import type { PairedSense } from '../engine/ops';
import { crewRoles, findCrewRoleById, findCrewTestTypeById, findVehicleById, findSeaShantyById } from '../data';
import { estNavire, profilNavalDe } from '../engine/coque';
import { exposedCrew } from '../engine/shipCritical';
import { knownShanties } from '../engine/combatFeatures/dispatch';
import { partyBest, peutTenter, testValue } from '../engine/skills';
import { rollLine, type RollLineParts } from './ligneDeJet';
import { maxBy } from '../engine/pick';
import { applyOps } from '../engine/ops';
import { removeActiveEffects, isOutOfAction } from '../engine/conditions';
import { battleRng } from './battleRng';
import { t } from '../i18n';
import type { Get, Set as SetFn } from './flowTypes';
import type { CorpsDesChoix } from './choixDesFenetres';
import { equipageApte, ecrireActeur, inBattleId } from './monde/combatants';
import { garanti } from '../lib/garanti';
import { propulsionDuNavire, milieuDuVoyage } from '../engine/shipBuild';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import { estCompetenceDePropulsion } from '../engine/propulsion';
import { choisirLaMunition } from '../engine/items';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';
import type { Scene } from './monde/scene';
import { spawnEnemy } from './monde/spawn';
import { posteDeLaBataille } from './monde/shipPostes';
import { freeTilesNear, inscrireEnBataille } from './summonFlow';
import type { SortiesDeFenetre } from './sortieDeFenetre';

/**
 * Assignation de l'équipage APTE d'un navire aux rôles qui contribuent à `testTypeId` (MDG 14). Chaque marin tient
 * son rôle ÉPINGLÉ (`shipRole`) ; à défaut, c'est CE module qui l'affecte pour le Test (`shipDefaultRoles`),
 * filtré aux rôles du type de Test (`crew-test-types.json`) — l'inférence vit ICI, et nulle part ailleurs.
 * Au plus UN marin par rôle : en cas de collision, le MEILLEUR pour ce rôle (`crewRoleValue`). PUR.
 */
/** Marqueur « au repos » : valeur de `shipRole` qui dit « ce marin ne tient AUCUN rôle ». Épinglée comme un
 *  poste (ligne « Repos » du roster, `noyau/poste.reposAsPoste`), elle est respectée telle quelle par
 *  `shipDefaultRoles` — donc exclue de tout Test d'équipage. */
export const BENCHED = 'repos';

/** Un marin est-il FORMÉ pour un rôle à bord (`competencesDuRole`) : il porte une de ses Compétences ET
 *  peut en tenter le Test (`peutTenter`) — LDB 09 l.30. PUR. */
function trainedForRole(c: Combatant, roleId: string, navigation: RefDesignee): boolean {
  const role = findCrewRoleById(roleId);
  return !!role && competencesDuRole(role, navigation).some((s) =>
    (c.skills ?? []).some((k) => refCouvre(s, k)) && peutTenter(c, { skill: s }));
}

/**
 * Assignation par DÉFAUT de l'équipage aux rôles d'un Test (MDG 14) — GLOBALE (pas marin par marin), pour que le
 * défaut soit BON : on remplit d'abord le rôle ESSENTIEL puis les autres rôles SPÉCIFIQUES avec le MEILLEUR marin
 * FORMÉ encore libre (un titulaire par poste → on ÉTALE l'équipage au lieu d'entasser 2 PJ sur le même) ; le reste
 * tombe **Mousse** (rôle par défaut, l.15) s'il sait Voile/Ramer. Les rôles ÉPINGLÉS (`shipRole`) sont respectés —
 * et un poste épinglé PEUT avoir plusieurs titulaires (l.9). Renvoie `crewId → roleId`. PUR. */
export function shipDefaultRoles(crew: Combatant[], testTypeId: string, navigation: RefDesignee): Map<string, string> {
  const out = new Map<string, string>();
  const testType = findCrewTestTypeById(testTypeId);
  if (!testType) return out;
  const apte = exposedCrew(crew);
  const free = new Set<string>();
  for (const c of apte) { if (c.shipRole) out.set(c.id, c.shipRole); else free.add(c.id); } // épinglés respectés (dont 'repos')
  const parDefaut = crewRoles.find((r) => r.parDefaut)?.id;
  // Rôles SPÉCIFIQUES (hors rôle par défaut), ESSENTIEL d'abord : UN titulaire chacun = le meilleur marin FORMÉ encore libre.
  const specific = testType.roles.filter((r) => r !== parDefaut)
    .sort((a, b) => (a === testType.essential.id ? -1 : b === testType.essential.id ? 1 : 0));
  for (const roleId of specific) {
    if ([...out.values()].includes(roleId)) continue; // déjà tenu (épinglé)
    const role = findCrewRoleById(roleId)!;
    // Meilleur marin FORMÉ encore libre : `partyBest` (skill/characteristic indéfinis → `testValue`=0) score PUREMENT sur
    // `crewRoleValue`. Le `.filter` préserve l'ordre d'`apte` → first-max identique à la boucle strict-`>` d'origine.
    const candidates = apte.filter((c) => free.has(c.id) && trainedForRole(c, roleId, navigation));
    const winner = partyBest(candidates, {}, (c) => crewRoleValue(c, role, navigation).value ?? -Infinity)?.actor;
    if (winner) { out.set(winner.id, roleId); free.delete(winner.id); }
  }
  // Le reste → rôle par défaut (MDG 14 l.15) s'il en a la formation.
  if (parDefaut && testType.roles.some((r) => r === parDefaut)) for (const id of free) {
    const c = apte.find((x) => x.id === id)!;
    if (peutTenter(c) && trainedForRole(c, parDefaut, navigation)) out.set(id, parDefaut);
  }
  return out;
}

/** Rôle d'équipage à Compétence de propulsion (`crew-roles.json` ; MDG 14 l.24-32, l.69). PUR. */
function roleDePropulsion(roleId: string | undefined): boolean {
  const role = roleId ? findCrewRoleById(roleId) : undefined;
  return !!role?.skills.some((s) => estCompetenceDePropulsion(s.id));
}

/** Membres d'équipage IMPLIQUÉS dans le maniement des voiles ou des avirons (MDG 13 l.111) : les aptes
 *  dont le poste de Progression (`shipDefaultRoles`) est un rôle de propulsion, plus les `manieurs` du
 *  jour (MDG 13 l.22-24, l.111). PUR. */
export function equipageImplique(party: readonly Combatant[], manieurs: readonly string[], navigation: RefDesignee): Combatant[] {
  const apte = equipageApte(party);
  const postes = shipDefaultRoles(apte, 'progression', navigation);
  return apte.filter((c) => manieurs.includes(c.id) || roleDePropulsion(postes.get(c.id)));
}

/** Compétence de Navigation de la coque `ship` dans le milieu du voyage en cours (`propulsionDuNavire`,
 *  MDG 13 l.18-19), que le schéma de véhicule garantit. */
export function navigationDuNavire(get: Get, ship: Combatant): RefDesignee {
  return garanti(propulsionDuNavire(ship.creatureId, ship.upgrades, milieuDuVoyage(get().travelPlan)), ship.creatureId, 'propulsion du navire').competence;
}

export function shipCrewAssignments(ship: Combatant, combatants: Combatant[], testTypeId: string, navigation: RefDesignee): CrewAssignment[] {
  const roleSet = new Set<string>(findCrewTestTypeById(testTypeId)?.roles ?? []);
  const crew = (ship.crewIds ?? [])
    .map((id) => combatants.find((c) => c.id === id))
    .filter((c): c is Combatant => !!c);
  // Une entrée PAR titulaire de rôle (le rôle vient du défaut GLOBAL `shipDefaultRoles` : essentiel rempli + PJ étalés).
  // Filtré aux rôles de CE Test (exclut 'repos' et les rôles d'un autre Test). MULTI possible si épinglé (MDG 14 l.9).
  const roles = shipDefaultRoles(crew, testTypeId, navigation);
  const out: CrewAssignment[] = [];
  for (const c of exposedCrew(crew)) {
    const roleId = roles.get(c.id);
    if (roleId && roleSet.has(roleId)) out.push({ crew: c, roleId });
  }
  return out;
}

/**
 * Contributeurs d'un Test d'équipage (MDG 14) — UN jet par POSTE, pas par marin. Par rôle tenu : TOUS les PJ du
 * poste lancent (l.9 « plusieurs Personnages peuvent contribuer ») ; sinon UN seul marin REPRÉSENTANT (le meilleur),
 * car « la performance des Personnages représente celle de tout l'équipage » (l.39) — les PNJ ne testent que pour un
 * rôle qu'AUCUN PJ n'occupe (l.41). PARTAGÉ par la manœuvre ET la bordée (`testTypeId`). `partyIds` = les PJ.
 * `sense` (Test à sens dominant, ex. Vigie visuelle, #149) écarte la pénalité sensorielle hors-sujet du RANKING
 * du marin représentant — parité avec la valeur de Test (#158). PUR. */
export function crewTestContributors(ship: Combatant, combatants: Combatant[], testTypeId: string, partyIds: Set<string>, navigation: RefDesignee, sense?: PairedSense): CrewAssignment[] {
  const roleVal = (a: CrewAssignment) => { const r = findCrewRoleById(a.roleId); return r ? crewRoleValue(a.crew, r, navigation, sense).value ?? -Infinity : 0; };
  const byRole = new Map<string, CrewAssignment[]>();
  for (const a of shipCrewAssignments(ship, combatants, testTypeId, navigation)) (byRole.get(a.roleId) ?? byRole.set(a.roleId, []).get(a.roleId)!).push(a);
  const out: CrewAssignment[] = [];
  for (const group of byRole.values()) {
    const pjs = group.filter((a) => partyIds.has(a.crew.id));
    if (pjs.length) out.push(...pjs); // chaque PJ du poste lance (l.9)
    else out.push(maxBy(group, roleVal)!.item); // sinon UN marin représentant (l.39/41) — first-max = earlier item, `group` non-vide (else)
  }
  return out;
}

/** Ajoute des marins à la liste « ayant agi ce Round » d'un navire (Manque de bras / cumul, MDG 14 l.53). PUR
 *  (renvoie un nouveau `crewActed`). Dédupliqué : un marin déjà listé n'y figure qu'une fois. */
export function withCrewActed(crewActed: Record<string, string[]> | undefined, shipId: string, ids: string[]): Record<string, string[]> {
  return { ...(crewActed ?? {}), [shipId]: [...new Set([...(crewActed?.[shipId] ?? []), ...ids])] };
}

/**
 * Moral effectif d'un navire pour un Test d'équipage (la bande de Moral pèse en ±DR, MDG 14). Pont CAMPAGNE → COMBAT :
 * la coque `Combatant` ne porte AUCUN Moral (il vit sur `CampaignVessel`, recalc hebdomadaire) → on lit `vessel.morale.score`
 * si la coque EST le navire de campagne, sinon `moraleBase()` (équipage neuf). Dérivé à l'usage, jamais stocké sur la coque.
 */
export function shipMoraleScore(get: Get, ship: Combatant): number {
  const vessel = get().vessel;
  return vessel && ship.creatureId === vessel.vehicleId ? vessel.morale.score : moraleBase();
}

/**
 * POPULATION EMBARQUÉE qui consomme eau et vivres (MDG 14 l.238 : « l'équipage … a besoin de beaucoup d'eau
 * et de nourriture pour rester en forme ») — SOURCE CANONIQUE unique : les héros (PJ à bord) PLUS l'effectif
 * PNJ NOMINAL encore présent (`ship.crew − crewLost`, MÊME agrégat que le Manque de bras / la désertion /
 * l'Embrigadement). Le roster salarié (`vessel.crew`, #216) REMPLIT ces postes nominaux — jamais des corps EN
 * SUS (la caractéristique Équipage du type EST le complément entier, MDG 12 l.85) → jamais additionné, sous
 * peine de double compte. `heroes`/`crew` séparés pour le manifeste (les héros mangent leurs rations, l'équipage
 * ses vivres de cale). PUR. */
export function shipboardSouls(s: Pick<Jeu, 'party' | 'vessel'>): { heroes: number; crew: number; total: number } {
  const heroes = s.party.filter((h) => !h.dead).length;
  const vessel = s.vessel;
  const nominal = vessel ? findVehicleById(vessel.vehicleId)?.ship?.crew ?? 0 : 0;
  const crew = Math.max(0, nominal - (vessel?.crewLost ?? 0));
  return { heroes, crew, total: heroes + crew };
}

/**
 * Manque de bras GLOBAL d'un navire (MDG 14 l.55) : `undercrewPenalty(nominal, présent)` où le NOMINAL vient
 * du type (`vehicles.json` ship.crew) et le PRÉSENT = les `crewIds` encore EN ÉTAT (`exposedCrew`), MOINS les
 * marins déjà retirés de la campagne par Embrigadement (MDG 15 l.245, `CampaignVessel.crewLost`). Les
 * morts/inconscients de combat (Éclats, critiques « Équipage ») alimentent aussi le déficit. Lit l'état persistant
 * du vaisseau de campagne comme `shipMoraleScore` (keyé `creatureId === vehicleId`). */
export function shipUndercrew(get: Get, ship: Combatant, combatants: Combatant[]): UndercrewPenalty {
  const nominal = profilNavalDe(ship)?.crew ?? 0;
  // Équipage ABSTRAIT (MDG 14 l.39 : « la performance des Personnages représente celle de tout l'équipage ») → le
  // complément NOMINAL est réputé PRÉSENT ; seule l'ATTRITION RÉELLE creuse le Manque de bras : les marins NOMMÉS
  // tombés au combat (Éclats, critique « Équipage ») + les pertes de CAMPAGNE (Embrigadement `crewLost`, MDG 15 l.245).
  // Un navire authoré avec 2 marins nommés sur 15 n'est donc PAS sous-effectif (les 2 représentent les 15).
  // (Le cas « scène listant les 15 marins » reste identique : nominal − nommés_morts − crewLost.)
  const named = (ship.crewIds ?? []).map((id) => combatants.find((c) => c.id === id)).filter((c): c is Combatant => !!c);
  const deadNamed = named.length - exposedCrew(named).length;
  const vessel = get().vessel;
  const lost = vessel && ship.creatureId === vessel.vehicleId ? (vessel.crewLost ?? 0) : 0;
  return undercrewPenalty(nominal, Math.max(0, nominal - lost - deadNamed));
}

/** MDG 14 l.45-47 : « de -1 à -5 DR sur le Test d'équipage ». PUR. */
export function clampSaboteurDR(dr: number): number {
  return Math.max(-5, Math.min(0, dr));
}

/** SABOTAGE des Tests d'équipage d'une coque — lit `Combatant.saboteurDR` (authoré par le scénario)
 *  CLAMPÉ à la fourchette RAW [-5, 0]. PUR. */
export function shipSaboteurDR(ship: Combatant): number {
  return clampSaboteurDR(ship.saboteurDR ?? 0);
}

/** QUART de veille (MDG 09 l.40 : « Une seule chanson de marin peut être chantée lors de chaque quart ») —
 *  le RAW ne chiffre pas le quart ; on prend le quart de veille naval STANDARD de 4 heures (240 min). */
export const QUART_MINUTES = 240;
export const quartIndex = (gameTime: number): number => Math.floor(gameTime / QUART_MINUTES);

/** Le quart en cours a-t-il déjà eu la chanson de ce navire ? MDG 09 l.40. */
export const quartChante = (ship: Combatant, gameTime: number): boolean => ship.lastShantyQuart === quartIndex(gameTime);

/** Le CHANTEUR du navire (`exposedCrew`, `knownShanties`, `singingShanty`), lu par le gate `chanteur-disponible`
 *  et `chanterLaChanson`. MDG 09 l.32-38. */
export function chanteurDuNavire(ship: Combatant, battle: BattleState): Combatant | undefined {
  const crew = exposedCrew((ship.crewIds ?? []).map((id) => inBattleId(battle, id)).filter((c): c is Combatant => !!c));
  return crew.filter((c) => knownShanties(c).length > 0 && !c.singingShanty)
    .sort((a, b) => knownShanties(b).length - knownShanties(a).length)[0];
}

/** Préfixe d'identité des effets de chanson (retrait ciblé à l'interruption — MDG 09 l.38). */
const SHANTY_LABEL = (label: string): string => t('crew.shantyLabel', { label });

/**
 * APPLIQUE une chanson de marin RÉUSSIE (MDG 09 l.36-40 + l.218-248) : ses `crewOps` sur CHAQUE membre
 * d'équipage APTE (« Une chanson de marin affecte un équipage entier », l.36) et ses `captainOps` sur le
 * seul TITULAIRE du rôle Capitaine (« Suivez le capitaine », l.246-248). Durée : « trois minutes plus un
 * nombre de minutes égal au DR » (l.38) → effets d'HORLOGE (`defaultUntilTime`). Pose l'identité de chant
 * sur le chanteur (interruption sur Dégâts, l.38) et consomme le QUART du navire (l.40). Renvoie le journal.
 */
/** MDG 09 l.36. */
const TEST_DE_CHANSON = { skill: { id: 'divertissement', spec: 'chant' } } as const;

/** Valeur du Test de Chanson de marin — MDG 09 l.34-36. */
export function valeurDeChanson(singer: Combatant): number {
  return testValue(singer, TEST_DE_CHANSON);
}

/** Ligne du Test de Chanson de marin (`rollLine`) — MDG 09 l.34-36. */
export function ligneDeChanson(singer: Combatant): RollLineParts {
  return rollLine({ actor: singer, test: TEST_DE_CHANSON, difficulty: 'intermediaire' });
}

/** Durée en minutes de l'effet d'une Chanson de marin au DR `sl` — MDG 09 l.38. */
export function dureeDeChanson(sl: number): number {
  return 3 + Math.max(0, sl);
}

export function applyShantyToCrew(get: Get, ship: Combatant, singer: Combatant, shantyId: string, sl: number): string[] {
  const shanty = findSeaShantyById(shantyId);
  if (!shanty) return [];
  const label = SHANTY_LABEL(shanty.label);
  const minutes = dureeDeChanson(sl);
  const until = get().gameTime + minutes;
  const combatants = get().battle?.combatants ?? get().party;
  const crew = exposedCrew((ship.crewIds ?? []).map((id) => combatants.find((c) => c.id === id)).filter((c): c is Combatant => !!c));
  const lines: string[] = [t('crew.shantyStart', { name: singer.label, shanty: shanty.label, min: minutes })];
  for (const c of crew) if (shanty.crewOps?.length) lines.push(...applyOps(c, shanty.crewOps, { idNeuf: get().forgerUnId, label, effectId: shantyId, rng: battleRng(), defaultUntilTime: until }));
  if (shanty.captainOps?.length) {
    const roles = shipDefaultRoles(crew, 'manoeuvre', navigationDuNavire(get, ship));
    const captain = crew.find((c) => roles.get(c.id) === 'capitaine');
    if (captain) lines.push(...applyOps(captain, shanty.captainOps, { idNeuf: get().forgerUnId, label, effectId: shantyId, rng: battleRng(), defaultUntilTime: until }));
    else lines.push(t('crew.noCaptain'));
  }
  singer.singingShanty = { shantyId, label };
  ship.lastShantyQuart = quartIndex(get().gameTime);
  return lines;
}

/** FIN DE CHANT (MDG 09 l.38 : « Si le Personnage subit des Dégâts ou rate un Test opposé, sa Chanson de
 *  marin prend fin ») : retire l'effet de la chanson de TOUS les combattants (retrait par IDENTITÉ
 *  d'`effectId` = `shantyId` stable, ≠ libellé FR ; même chemin que l'expiration — `removeActiveEffects`).
 *  Renvoie une ligne de journal, ou []. */
export function endShanty(get: Get, singer: Combatant): string[] {
  const song = singer.singingShanty;
  if (!song) return [];
  delete singer.singingShanty;
  const combatants = get().battle?.combatants ?? get().party;
  const porte: string[] = []; // États PORTÉS par la chanson (#1695) : ils partent avec elle, et ça se dit
  for (const c of combatants) removeActiveEffects(c, (e) => e.effectId === song.shantyId, undefined, porte);
  return [t('crew.shantyEnd', { name: singer.label }), ...porte];
}

/**
 * Résolution d'un NAVIRE comme UNITÉ DE COMBAT — abordage & naufrage (MDG 13-14). Un navire au combat =
 * sa COQUE (`estNavire`, à PV) + son ÉQUIPAGE (`crewIds`, de vrais combattants exposés). L'unité
 * sort du combat dès qu'UNE des deux issues RAW est atteinte — dans les DEUX sens, pour que la victoire
 * navale soit gagnable par CHAQUE voie :
 *  - **NAUFRAGE** — la coque coule (`isOutOfAction` : Indice d'Inondation égal à l'Endurance, MDG 13 l.674 ;
 *    à 0 Blessure elle reste en jeu, MDG 13 l.656). L'équipage encore en
 *    état passe par-dessus bord : il QUITTE la rencontre (`outOfRencontre`). Sans ça, couler le navire ne
 *    suffirait pas (l'équipage flotterait, or il est quasi inentamable en mêlée — table des Tailles ch.13
 *    l.618-637), et la voie « naufrage » ne conclurait jamais.
 *  - **PRISE À L'ABORDAGE** — tout l'équipage exposé est hors de combat (MDG 13 l.420 : « un abordage
 *    déterminé »). Sans personne à bord pour la défendre ou la manœuvrer, la coque sort du combat
 *    (`outOfRencontre`). Sans ça, vaincre l'équipage ne conclurait jamais (la coque, inentamable en mêlée,
 *    resterait un ennemi « vivant »).
 * KIND-AGNOSTIQUE (coque amie ou ennemie) mais ne s'active QUE sur une coque à équipage DÉCLARÉ
 * (`crewIds.length`) : une coque-cible SANS équipage ne se résout que par le naufrage de ses propres PV
 * (sinon elle serait « prise » d'emblée, l'ensemble vide étant vacuément vaincu). Mute EN PLACE, renvoie le
 * journal ; idempotent (une unité déjà résolue reste `outOfRencontre`). Appelé par `checkBattleOver`.
 */
export function resolveShipUnits(combatants: Combatant[]): string[] {
  const lines: string[] = [];
  for (const hull of combatants) {
    if (!estNavire(hull) || !hull.crewIds?.length || !hull.wounds) continue;
    const crew = hull.crewIds
      .map((id) => combatants.find((c) => c.id === id))
      .filter((c): c is Combatant => !!c);
    if (isOutOfAction(hull)) {
      // Naufrage : l'équipage encore en état sombre avec le navire (sort de la rencontre).
      const aboard = exposedCrew(crew).filter((c) => !isOutOfAction(c));
      if (aboard.length) {
        for (const c of aboard) { c.outOfRencontre = true; c.exitReason = 'naufrage'; } // #237 : éjecté vivant, lu « hors-combat »
        lines.push(t('crew.sinks', { ship: hull.label, crew: aboard.map((c) => c.label).join(', ') }));
      }
    } else if (crew.length && crew.every((c) => isOutOfAction(c))) {
      // Plus personne à bord : la coque, sans équipage pour la défendre ni la manœuvrer, quitte le combat.
      hull.outOfRencontre = true;
      hull.exitReason = 'prise'; // #237 : coque amenée, lue « rendu » (pavillon baissé) au token de coque
      lines.push(t('crew.taken', { ship: hull.label }));
    }
  }
  return lines;
}

/**
 * VAGUES D'ABORDAGE : une coque dont tout l'équipage exposé (`crewIds`) est hors de combat et qui garde des
 * marins en RÉSERVE (`reserveDAbordage`) en fait monter une vague neuve, placée près d'elle, inscrite à
 * l'initiative après elle et rattachée à son équipage. Passe AVANT `resolveShipUnits`, qui sinon déclarerait
 * la coque prise. Mute EN PLACE, renvoie le journal. Appelé par `checkBattleOver`. MDG 15 l.150, l.171
 */
export function monterLesVagues(battle: BattleState, scene: Scene): string[] {
  const lines: string[] = [];
  for (const hull of [...battle.combatants]) {
    const r = hull.reserveDAbordage;
    if (!r?.restant || !hull.pos || !hull.crewIds?.length || isOutOfAction(hull)) continue;
    if (!hull.crewIds.every((id) => { const c = inBattleId(battle, id); return !c || isOutOfAction(c); })) continue;
    const base = battle.combatants.length;
    const montes = freeTilesNear(scene, battle, hull.pos, Math.min(r.vague, r.restant)).map((pos, i) => {
      const c = spawnEnemy({ ref: r.ref }, `${hull.id}-vague-${base}-${i}`, pos);
      c.kind = hull.kind;
      return c;
    });
    if (!montes.length) continue;
    for (const c of montes) inscrireEnBataille(battle, c, hull.id);
    hull.crewIds = [...hull.crewIds, ...montes.map((c) => c.id)];
    hull.reserveDAbordage = { ...r, restant: r.restant - montes.length };
    lines.push(t('crew.vagueDAbordage', { ship: hull.label, n: montes.length, restant: r.restant - montes.length }));
  }
  return lines;
}

/**
 * Applique un DELTA de Moral au NAVIRE DE CAMPAGNE (MDG 14 — Rude épreuve l.110 : le Moral évolue en jeu,
 * pas seulement au recalc hebdomadaire) : PERSISTE sur `CampaignVessel.morale.score` quand la coque EST le
 * navire de campagne (sinon no-op : une coque adverse/transitoire ne suit pas de Moral). Renvoie les lignes
 * de journal (delta + changement de bande éventuel — « Des canailles que je ne parviens pas à mater »).
 */
export function applyShipMoraleDelta(get: Get, set: SetFn, ship: Combatant, delta: number): string[] {
  const vessel = get().vessel;
  if (!delta || !vessel || ship.creatureId !== vessel.vehicleId) return [];
  const before = vessel.morale.score;
  const after = before + delta;
  set({ vessel: { ...vessel, morale: { ...vessel.morale, score: after } } });
  const lines = [t('crew.moraleDelta', { delta: `${delta > 0 ? '+' : ''}${delta}`, before, after })];
  const bandAfter = moraleBand(after);
  if (bandAfter.id !== moraleBand(before).id) lines.push(t('crew.moraleBand', { titre: bandAfter.label }));
  return lines;
}

/** CONSEIL DE BORD hebdomadaire (#229) : phase `choix` de la paie (aucune mutation), puis `bilan` où le
 *  recalcul de Moral se joue (PV des facteurs + delta + nouvelle bande). Ancré au navire de campagne unique. */
export interface PendingCouncil extends PendingBase {
  /** Jour de campagne au franchissement de semaine (source de la semaine recalculée). */
  today: number;
  /** Barème hebdomadaire (solde régulière due, sous de cuivre) — base des montants offerts. */
  wageBrass: number;
  phase: 'choix' | 'bilan';
  /** bilan : id du facteur de paie retenu. */
  decision?: string;
  /** bilan : semaines réglées par la décision (`semainesDuConseil` à l'arrêt de la paie). */
  semaines?: number;
  /** bilan : procès-verbal des jets de Moral (un par facteur). */
  results?: NightEntry[];
  /** bilan : variation totale, avant/après (nouvelle bande dérivée d'`after`). */
  delta?: number;
  before?: number;
  after?: number;
}

/** Résultat PUR d'une semaine d'entretien du navire (paie + recalcul du Moral). */
export interface VesselWeekOutcome {
  /** Navire mis à jour (Moral recalculé, `lastMoraleWeek` avancé, `wagesOwed` cumulé). */
  vessel: CampaignVessel;
  /** Ligne de journal de la PAIE (ou null : aucun équipage salarié). */
  paidLine: string | null;
  /** Solde EFFECTIVEMENT versée cette semaine (sous de cuivre). */
  costBrass: number;
  /** Jets de Moral par facteur (surface le recalcul en procès-verbal). */
  factorRolls: MoraleRoll[];
  delta: number;
  before: number;
  after: number;
  /** Journal complet (paie + Moral recalculé + un jet par facteur). */
  lines: string[];
}
type MoraleRoll = { id: string; label: string; rolled: number };

/**
 * Cœur PUR de l'entretien HEBDOMADAIRE du navire de campagne (MDG 14) : PAIE de l'équipage salarié selon
 * la DÉCISION `decision` (id d'un facteur de paie de `PAY_CHOICES`, ou null = pas d'équipage salarié) PUIS
 * recalcul du Moral. Ne lit ni ne mute le store — prend le navire + le TOTAL des bourses du groupe (pour la
 * solvabilité), renvoie le navire recalculé + le coût à débiter (`costBrass`) + le procès-verbal ; le DÉBIT
 * de groupe (gages, sans bénéficiaire unique) est appliqué par l'appelant via `payFromGroup`. La solde =
 * `payChoiceCostBrass(barème, decision)` (le barème `wageMul` de chaque choix, en donnée) ; un choix
 * GRATUIT (`wageMul: 0`, ou un groupe insolvable qui s'y replie) cumule la solde due dans `wagesOwed`. Le facteur de
 * paie n'est injecté que pour le recalcul de CETTE semaine, jamais persisté dans `morale.factors` (édités
 * par l'auteur). #216/#229. RNG injecté.
 */
export function resolveVesselWeek(vessel: CampaignVessel, purse: Money, decision: string | null, week: number, rng: RNG): VesselWeekOutcome {
  const wageBrass = weeklyCrewWageBrass(vessel.crew);
  const lines: string[] = [];
  let paidFactor: string | null = null;
  let paidLine: string | null = null;
  let costBrass = 0;
  let wagesOwed = vessel.wagesOwed ?? 0;
  if (wageBrass > 0 && decision && isPayChoice(decision)) {
    if (isFreePayChoice(decision)) {
      paidFactor = decision;
      wagesOwed += wageBrass;
      paidLine = t('crew.unpaid', { money: formatMoney(fromBrass(wageBrass)) });
    } else {
      costBrass = payChoiceCostBrass(wageBrass, decision);
      const cost = fromBrass(costBrass);
      if (canAfford(purse, cost)) {
        paidFactor = decision;
        paidLine = t('crew.paid', { money: formatMoney(cost) });
      } else {
        // Bourse insuffisante → repli sur le choix GRATUIT du registre + dette (défaut de la cadence
        // auto ; en Conseil de bord manuel l'option non payable est désactivée, ce repli ne s'y produit pas).
        paidFactor = freePayChoiceId();
        costBrass = 0;
        wagesOwed += wageBrass;
        paidLine = t('crew.cannotPay', { money: formatMoney(cost) });
      }
    }
    lines.push(paidLine);
  }
  const factorsThisWeek = paidFactor && !vessel.morale.factors.includes(paidFactor)
    ? [...vessel.morale.factors, paidFactor]
    : vessel.morale.factors;
  const before = vessel.morale.score;
  const r = recalcMorale(before, factorsThisWeek, rng);
  const newVessel: CampaignVessel = {
    ...vessel,
    morale: { ...vessel.morale, score: r.score, lastMoraleWeek: week },
    ...(wagesOwed ? { wagesOwed } : {}),
  };
  lines.push(t('crew.moraleRecalc', { score: r.score, band: moraleBand(r.score).label }), ...r.lines);
  return { vessel: newVessel, paidLine, costBrass, factorRolls: r.rolls, delta: r.delta, before, after: r.score, lines };
}

/** Décision de paie PAR DÉFAUT de la cadence auto (#216) : paie RÉGULIÈRE dès qu'il y a un équipage
 *  salarié — `resolveVesselWeek` bascule seul sur le repli « bourse insuffisante » (dette) si besoin ;
 *  null sans équipage salarié. PUR. */
function defaultPayDecision(wageBrass: number): string | null {
  return wageBrass > 0 ? recommendedPayChoiceId() : null;
}

/**
 * Entretien HEBDOMADAIRE du navire de campagne (MDG 14) — appelé par `upkeep.ts` (site UNIQUE) à chaque entretien,
 * règle les semaines calendaires franchies depuis `lastMoraleWeek`. CADENCE-AWARE (#229) : quand un humain est à la barre
 * (cadence MANUELLE) et qu'un vrai choix de paie existe (équipage salarié), la décision REMONTE en CONSEIL DE
 * BORD (modale `pendingCouncil`) — aucune mutation ici, le recalcul se joue à la validation du joueur. Il n'y
 * a pas de combattant « navire » à piloter → le prédicat de contrôle canonique se réduit à la cadence
 * (`cadenceAuto` ; en Rapide/Auto le recalcul se résout seul, comme un jet de fin de Round). En combat, jamais
 * de conseil (repli auto silencieux). Cadence auto / pas d'équipage salarié → recalcul immédiat, régulière par
 * défaut (#216). Chaque semaine franchie se règle (`reglerLesSemaines`) ; un Conseil en cours vaut pour les semaines
 * qui passent pendant qu'il siège (bloc étendu en phase `choix`, reprises au prochain entretien en phase `bilan`).
 * Renvoie le journal (vide si aucune semaine franchie / conseil convoqué / pas de navire). RNG injecté.
 */
export function tickCampaignVesselWeek(get: Get, set: SetFn, today: number, rng: RNG): string[] {
  const vessel = get().vessel;
  if (!vessel) return [];
  const week = semaineDuJour(today);
  if (week <= vessel.morale.lastMoraleWeek) return [];
  const conseil = get().pendingCouncil;
  if (conseil) {
    if (conseil.phase === 'choix') set({ pendingCouncil: { ...conseil, today } });
    return [];
  }
  const wageBrass = weeklyCrewWageBrass(vessel.crew);
  if (!cadenceAuto() && wageBrass > 0 && !get().battle) {
    set({ pendingCouncil: { today, wageBrass, phase: 'choix' } });
    return [];
  }
  return reglerLesSemaines(get, set, defaultPayDecision(wageBrass), week, rng).lines;
}

/** Semaine calendaire d'un jour de campagne (`lastMoraleWeek`, `PendingCouncil.today`). */
export function semaineDuJour(jour: number): number {
  return Math.floor(jour / 7);
}

/** Semaines que le Conseil de bord en phase `choix` règle d'une décision : de `lastMoraleWeek + 1` à sa semaine. */
export function semainesDuConseil(s: Jeu): number {
  const p = s.pendingCouncil;
  return p && s.vessel ? semaineDuJour(p.today) - s.vessel.morale.lastMoraleWeek : 0;
}

/** Règle chaque semaine franchie, de `lastMoraleWeek + 1` à `week` (MDG 14 l.143, l.293-302) : une solde et un
 *  recalcul du Moral par semaine, sous la même `decision`. Débite le groupe semaine après semaine (la solvabilité de
 *  chaque semaine lit la bourse restante). Renvoie le procès-verbal cumulé du bloc. */
function reglerLesSemaines(get: Get, set: SetFn, decision: string | null, week: number, rng: RNG): Pick<VesselWeekOutcome, 'factorRolls' | 'delta' | 'before' | 'after' | 'lines'> {
  let vessel = garanti(get().vessel, week, 'navire de campagne');
  const bloc = { factorRolls: [] as MoraleRoll[], delta: 0, before: vessel.morale.score, after: vessel.morale.score, lines: [] as string[] };
  for (let w = vessel.morale.lastMoraleWeek + 1; w <= week; w++) {
    const out = resolveVesselWeek(vessel, partyMoneyTotal(get), decision, w, rng);
    if (out.costBrass > 0) payFromGroup(get, set, fromBrass(out.costBrass), { purpose: 'gages équipage' });
    vessel = out.vessel;
    set({ vessel });
    bloc.factorRolls.push(...out.factorRolls);
    bloc.lines.push(...out.lines);
    bloc.delta += out.delta;
    bloc.after = out.after;
  }
  return bloc;
}

/** Une entrée de procès-verbal (`NightEntry`) par jet de facteur de Moral — non-d100 (dés signés `+2d10`),
 *  donc ligne de PV LECTURE SEULE (le recalcul de Moral n'est pas un Test influençable par la Chance). #229 */
function factorLedger(rolls: MoraleRoll[]): NightEntry[] {
  return rolls.map((f, i) => ({
    id: `council-factor-${i}`,
    icon: 'scenario/naval',
    label: f.label,
    text: t('crew.factorMorale', { delta: `${f.rolled >= 0 ? '+' : ''}${f.rolled}` }),
    tone: f.rolled > 0 ? 'reussite' : f.rolled < 0 ? 'echec' : 'neutre',
  }));
}

/**
 * CONSEIL DE BORD — le joueur ARRÊTE la paie du bloc de semaines franchies (#229, #1652). Phase `choix` (aucune
 * mutation encore) → `fenetreChoisir('conseil', 'paie', decision)` règle chaque semaine du bloc sous cette décision
 * (`reglerLesSemaines`, partagé avec la cadence auto : une solde et un recalcul par semaine, une ligne de solde par
 * semaine au journal) et bascule en phase `bilan` où le recalcul se JOUE (PV des facteurs de toutes les semaines + delta
 * cumulé + nouvelle bande). Le verbe n'admet qu'un choix que `refusDeChoixDePaie` ouvre (`OUVERTS_DU_CHOIX`) ; le choix
 * GRATUIT reste toujours offert.
 */
function arreterLaPaie(get: Get, set: SetFn, decision: string): void {
  const p = garanti(get().pendingCouncil, decision, 'Conseil de bord');
  if (!get().vessel) return;
  const semaines = semainesDuConseil(get());
  const bloc = reglerLesSemaines(get, set, decision, semaineDuJour(p.today), battleRng());
  set({ pendingCouncil: { ...p, phase: 'bilan', decision, semaines, results: factorLedger(bloc.factorRolls), delta: bloc.delta, before: bloc.before, after: bloc.after } });
  get().ecrireAuJournal(bloc.lines);
}

/** Les choix de paie que `fenetreChoisir('conseil', 'paie', …)` accepte : ceux du registre (`payChoices`) dont la bourse du groupe couvre la
 *  solde de tout le bloc (`semainesDuConseil`), le choix gratuit compris. Vide hors phase `choix` du Conseil. #229 */
export function choixDePaieOuverts(s: Jeu): string[] {
  const p = s.pendingCouncil;
  if (!p || p.phase !== 'choix' || !s.vessel) return [];
  const bourse = partyMoneyTotal(() => s);
  const semaines = semainesDuConseil(s);
  return payChoices().map((c) => c.factorId).filter((id) => isFreePayChoice(id) || canAfford(bourse, fromBrass(semaines * payChoiceCostBrass(p.wageBrass, id))));
}

/** Refus d'un choix de paie du Conseil : la bourse ne couvre pas ce choix ; `null` sinon. Lu par le choix de la paie
 *  (`OUVERTS_DU_CHOIX`), que `refusDuChoix` refuse d'abord à un invité. #229 */
export function refusDeChoixDePaie(s: Jeu, decision: string): string | null {
  return choixDePaieOuverts(s).includes(decision) ? null : t('crew.paieHorsBourse');
}

/** Les chansons que réglage `chansonDeMarin.chanson` accepte : celles que le chanteur de `pendingShanty` connaît (`knownShanties`) et que
 *  le catalogue porte, tant que le jet n'est pas tombé. MDG 09 l.32-40. */
export function chansonsDuChanteur(s: Jeu): string[] {
  const p = s.pendingShanty;
  const chanteur = p && !p.result && s.battle ? inBattleId(s.battle, p.singerId) : undefined;
  return chanteur ? knownShanties(chanteur).flatMap((id) => findSeaShantyById(id)?.id ?? []) : [];
}

/**
 * Applique un DELTA d'effectif PNJ CUMULÉ du navire de CAMPAGNE (op de navire `equipage`, MDG 15 l.245) :
 * PERSISTE sur `CampaignVessel.crewLost`, plafonné à `[0, nominal]` (`vehicles.json` ship.crew — même
 * source que `shipUndercrew`) dans les deux sens. `delta` positif = perte, négatif = recouvrement. Renvoie
 * le journal.
 */
export function applyVesselCrewLoss(get: Get, set: SetFn, delta: number): string[] {
  const vessel = get().vessel;
  if (!delta || !vessel) return [];
  const nominal = findVehicleById(vessel.vehicleId)?.ship?.crew ?? 0;
  const before = vessel.crewLost ?? 0;
  const after = Math.max(0, Math.min(nominal, before + delta));
  if (after === before) return [];
  set({ vessel: { ...vessel, crewLost: after } });
  return [t('crew.crewDelta', { delta: `${after > before ? '−' : '+'}${Math.abs(after - before)}`, left: Math.max(0, nominal - after), nominal })];
}

/**
 * DÉSERTION à la relâche à terre ACCORDÉE (MDG 14 l.192-202) : « Si l'équipage reçoit la permission de faire
 * relâche à terre, lancez 1d100 pour chaque membre d'équipage. Sur un résultat de [04 / 16] ou moins, ce
 * membre ne revient pas sur le bateau. » Seuil = `moraleBand(score).desertionRoll` (04 bande satisfaite,
 * 16 bande canailles ; ABSENT au-dessus de 75 → aucune désertion). Population = effectif PNJ PRÉSENT du
 * navire de campagne (`nominal − crewLost`, le MÊME agrégat que l'Embrigadement et le Manque de bras — pas
 * d'individus) ; les partants sont retirés par la couture partagée `applyVesselCrewLoss`. Événement SUBI
 * (pas un Test de héros, MDG 14 l.192-202). La FENÊTRE de ce dé existe et vit chez l'appelant : l'étape
 * `merDesertion` ouverte par `seaVoyageFlow` (`openWorldTest`) ; ce corps en est le rejeu POST-POSE, d'où
 * la porte SILENCIEUSE du canal (`deMonde`) — un dé par membre présent. RNG injecté. Renvoie le journal.
 */
export function resolveShoreLeaveDesertion(get: Get, set: SetFn, rng: RNG): string[] {
  const vessel = get().vessel;
  if (!vessel) return [];
  const threshold = moraleBand(vessel.morale.score).desertionRoll;
  if (!threshold) return []; // Moral > 75 : bande sans seuil de désertion (MDG 14 l.187-191)
  const present = shipboardSouls(get()).crew;
  let deserters = 0;
  for (let i = 0; i < present; i++) if (deMonde(rng) <= threshold) deserters++;
  if (!deserters) return [];
  return [t('crew.desertion', { n: deserters }), ...applyVesselCrewLoss(get, set, deserters)];
}

/** Le choix du Conseil de bord (`CorpsDesChoix`) : la paie de la semaine. #229 */
export function choixDeLEquipage(get: Get, set: SetFn) {
  return { conseil: { paie: (decision) => arreterLaPaie(get, set, decision) } } satisfies Partial<CorpsDesChoix>;
}

/** Le Conseil de bord se lève au bilan (`MODAL_DEFS.conseil.sortieFermee`) : le recalcul a déjà été appliqué à la
 *  validation de la paie. #229 */
export function sortiesDeLEquipage(_get: Get, set: SetFn) {
  return { conseil: () => set({ pendingCouncil: null }) } satisfies Partial<SortiesDeFenetre>;
}

export function creerActionsDeLEquipage(get: Get, set: SetFn) {
  return {
    affecterAuRoleABord: (crewId, role) => set((s) => ecrireActeur(s, crewId, (c) => ({ ...c, shipRole: role || undefined }))),
    affecterALaStation: (crewId, station) => set((s) => ecrireActeur(s, crewId, (c) => ({ ...c, shipStation: station || undefined }))),
    approvisionnerLaPiece: (posteUid, ammoUid) => {
      const b = get().battle;
      const poste = b && posteDeLaBataille(posteUid, b.combatants)?.poste;
      if (!b || !poste) return;
      // Le poste est PARTAGÉ par référence avec `mannedPoste` du chef (serveChef) → muter la même instance
      // suffit ; le `set` re-render (pattern combat : mutation + refresh). Le CHEF qui la sert lit la pièce par son
      // arme : la décharge lui ôte aussi son coup (`choisirLaMunition`).
      const chef = poste.crewIds?.[0] ? inBattleId(b, poste.crewIds[0]) : undefined;
      const gun = chef?.mannedPoste === poste ? chef.weapons.find((w) => w.uid === poste.item.uid) : undefined;
      choisirLaMunition(gun ? chef : undefined, gun, ammoUid ?? undefined, poste);
      set({ battle: { ...b } });
    },
  } satisfies FabriqueDuNoyau;
}
