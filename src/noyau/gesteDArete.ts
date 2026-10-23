/**
 * PORTEUR D'UN GESTE D'ARÊTE (#700, #2190) — prédicat UNIQUE de « ce mobile peut-il, maintenant,
 * accomplir ce geste depuis cette case ? ». Lu par l'ACTION (`climbAcross`, `fallAcross`,
 * `windowAcross`, ci-dessous) et par l'AFFICHAGE (marqueurs d'arête, `gameIso/stage/MondeDeCampagne.tsx`) :
 * afficher et agir ne peuvent pas répondre différemment (`netOwnership.ts`, `humanControlled`).
 *
 * Exploration : le mobile est le meneur DEBOUT (`meneurDeboutDuMonde`), sa case `partyPos`. Combat : le
 * PRÉFIXE du déplacement (`combatFlow.ts:mobileDuTour`, celui de `resolveMovement`), sa case `pos`.
 * Le coût propre à chaque geste (Mouvement, Action du Test) reste au geste.
 */
import type { Jeu, BattleState } from './etat';
import type { Combatant } from '../engine/types';
import type { Pt } from './monde/path';
import type { MsgKey, TrousVerifies } from '../i18n';
import { caseOpposee, type AreteUtilisable, type CapaciteArete } from './aretes';
import { mouvementDeLaChute, type RefusFranchissement, metresRetenus, planFranchissement, refusDesRangeesDues, tombantsNommes, mouvementDeLAllege } from './fallMove';
import { sceneMetresPerTile, type Scene, isWalkable, heightAt } from './monde/scene';
import { inBattleId, meneurDeboutDuMonde, estDebout } from './monde/combatants';
import { garanti } from '../lib/garanti';
import { mobileDuTour, type RefusDuTour } from './combatFlow';
import { isMount, isRider, movementRemaining } from './mount';
import { findActionById } from '../data';
import type { PendingFall } from './pendings';
import { jouerFlowEntier, applyEffects, ouvrirChute, effectTargets, runFlow, openSkillTest } from './combatEffects';
import { placeCombatant } from './monde/spawn';
import { t, trous } from '../i18n';
import { tileKey } from './monde/path';
import { moveEnv } from './monde/combatGeometry';
import { bus, EVT } from './bus';
import { refuserGeste } from './refusVisible';
import { hasAutoClimb, hasClimbFullSpeed } from '../engine/traits/dispatch';
import { planClimb } from './monde/climbMove';
import { poserLeGroupe } from './marcheDuGroupe';
import { climbMovementCost } from '../engine/movement';
import { ev } from './combatLog';
import { EMPTY_FLOW } from '../engine/flowCore';
import { rule } from '../engine/policy';
import { testDeRegle } from '../engine/reglesChiffrees';
import type { Get, Set } from './flowTypes';
import type { ActionsDuNoyau, GesteDuNoyau } from './actionsDuNoyau';

/** Les capacités d'arête qui DÉPLACENT le mobile — les trois gestes de ce prédicat —, et le verbe de chacune : il va
 *  de l'ancrage à la case d'en face (`caseOpposee`). */
const VERBE_DU_GESTE_DEPLACANT = { escalade: 'climbAcross', chute: 'fallAcross', fenetre: 'windowAcross' } as const satisfies Partial<Record<CapaciteArete, keyof ActionsDuNoyau>>;
export type GesteDeplacant = keyof typeof VERBE_DU_GESTE_DEPLACANT;

/** Le geste d'un dénivelé : son verbe, de l'ancrage à la case d'en face. */
export type GesteDeDenivele = { verbe: (typeof VERBE_DU_GESTE_DEPLACANT)[GesteDeplacant]; args: [de: Pt, vers: Pt] };

const estDeplacant = (c: CapaciteArete): c is GesteDeplacant => Object.prototype.hasOwnProperty.call(VERBE_DU_GESTE_DEPLACANT, c);

/** Le geste d'une arête qui déplace le mobile, `null` pour une autre capacité. */
export const gesteDeDenivele = (a: AreteUtilisable): GesteDeDenivele | null =>
  estDeplacant(a.capacite) ? { verbe: VERBE_DU_GESTE_DEPLACANT[a.capacite], args: [a.ancrage, caseOpposee(a)] } : null;

/** Le geste qu'une arête offre, en verbe du noyau : un dénivelé (`gesteDeDenivele`), l'accès qu'on actionne
 *  (`actionnerLaPorte`), la structure qu'on frappe par le clic de son Combattant (`battleClickEntity`). */
export function gesteDeLArete(a: AreteUtilisable): GesteDuNoyau | null {
  const denivele = gesteDeDenivele(a);
  if (denivele) return denivele;
  if (a.portail) return { verbe: 'actionnerLaPorte', args: [a.portail] };
  return a.cid ? { verbe: 'battleClickEntity', args: [a.cid] } : null;
}

/** Les arêtes offertes : un geste déplaçant n'est offert que si le mobile peut le jouer maintenant (`ouverts`,
 *  `gestesDeplacantsOuverts`). */
export const aretesOffertes = (aretes: readonly AreteUtilisable[], ouverts: boolean): AreteUtilisable[] =>
  ouverts ? [...aretes] : aretes.filter((a) => !estDeplacant(a.capacite));

export type RefusGeste = { refus: MsgKey; vars: TrousVerifies };
export type VerdictGeste = { mobile: Combatant; case: Pt } | RefusGeste;
/** Geste accordé : le mobile, sa case, et le monde où il se joue — `battle` nul hors combat. */
export type GesteOuvert = { mobile: Combatant; case: Pt; scene: Scene; battle: BattleState | null };

const REFUS_DU_TOUR: Readonly<Record<RefusDuTour, MsgKey>> = {
  'combat-over': 'geste.refus.combatTermine',
  targeting: 'geste.refus.ciblage',
  'no-active': 'geste.refus.aucunActif',
  'not-controlled': 'geste.refus.pasLaMain',
  engaged: 'geste.refus.engage',
  'movement-spent': 'geste.refus.mouvementEpuise',
};

/** LDB 14 l.179 ; CRB 032 l.53 ; #2205. */
const REFUS_MONTE: MsgKey = 'geste.refus.monte';

const refus = (cle: MsgKey, vars: TrousVerifies = trous({})): RefusGeste => ({ refus: cle, vars });

/** Libellé de l'action « Descendre » (`actions.json`, id `dismount`) — l'issue que le refus monté nomme. */
const libelleDescendre = (): string => garanti(findActionById('dismount'), 'dismount', 'action').label;

/** Ce que dit un plan de franchissement refusé (`fallMove.ts:RefusFranchissement`). */
export const REFUS_FRANCHISSEMENT: Readonly<Record<RefusFranchissement, MsgKey>> = {
  'non-adjacente': 'franchir.refus.nonAdjacente',
  'aucune-surface': 'franchir.refus.aucuneSurface',
  muree: 'franchir.refus.muree',
  escalade: 'franchir.refus.escalade',
  marche: 'franchir.refus.marche',
};

/** Exploration : le meneur DEBOUT, sur `partyPos`, hors dialogue — porteur de tout geste d'exploration
 *  du groupe (gestes d'arête, `fouillerLaPiece`). */
export function porteurDExploration(s: Jeu): VerdictGeste {
  if (s.dialogue) return refus('geste.refus.dialogue');
  const meneur = meneurDeboutDuMonde(s);
  if (!meneur) return refus('geste.refus.personne');
  return { mobile: meneur, case: s.partyPos };
}

/** Combat : le préfixe de tout déplacement (`mobileDuTour`), ses refus nommés. */
function porteurDeCombat(s: Jeu, battle: BattleState): VerdictGeste {
  const tour = mobileDuTour(s, battle);
  if (!('refus' in tour)) return tour;
  if (!tour.mobile) return refus(REFUS_DU_TOUR[tour.refus]);
  const vars = trous({ name: tour.mobile.label });
  // `canMove` refuse deux cas : Mouvement épuisé, ou Mouvement → Action → Mouvement (`mount.ts:canMove`).
  if (tour.refus === 'movement-spent' && movementRemaining(battle, tour.mobile) > 0) {
    return refus('geste.refus.mouvementEntrelace', vars);
  }
  return refus(REFUS_DU_TOUR[tour.refus], vars);
}

export function gesteDArete(s: Jeu): GesteOuvert | RefusGeste {
  const { scene } = s;
  if (!scene) return refus('geste.refus.aucuneScene');
  const battle = s.mode === 'battle' ? s.battle : null;
  const v = s.mode === 'exploration'
    ? porteurDExploration(s)
    : battle ? porteurDeCombat(s, battle) : refus('geste.refus.horsJeu');
  if ('refus' in v) return v;
  if (isRider(v.mobile) || isMount(v.mobile)) return refus(REFUS_MONTE, trous({ action: libelleDescendre() }));
  return { ...v, scene, battle };
}

/** Le geste part-il de la case du mobile ? (#2190 : un `from` falsifié téléportait l'actif.) */
export function gesteDepuis(s: Jeu, from: Pt): GesteOuvert | RefusGeste {
  const v = gesteDArete(s);
  if ('refus' in v) return v;
  const c = v.case;
  if (c.x !== from.x || c.y !== from.y || (c.z ?? 0) !== (from.z ?? 0)) {
    return refus('geste.refus.caseDuMobile', trous({ name: v.mobile.label }));
  }
  return v;
}

/** Le Test de chute tenté consomme l'Action (LDB 13 l.86-88) : refusé quand elle est déjà prise.
 *  `tombantId` = la rangée qui déclare. Lu par « Tenter » (`fallChoose`) et par son option dans la
 *  modale (`ui/FallModal.tsx`). */
export function refusDuTestDeChute(s: Jeu, tombantId: string): RefusGeste | null {
  const b = s.mode === 'battle' ? s.battle : null;
  if (!b?.acted) return null;
  return refus('fall.actionDejaPrise', trous({ name: garanti(inBattleId(b, tombantId), tombantId, 'sauteur').label }));
}

/** Se suspendre d'abord coûte, en combat, le Mouvement de `mouvementDeLaChute` : refusé quand le
 *  Mouvement restant ne le couvre pas. Lu par la déclaration (`fallChoose`) et par son option dans la
 *  modale (`ui/FallModal.tsx`). */
export function refusDeLaSuspension(s: Jeu, tombantId: string): RefusGeste | null {
  const b = s.mode === 'battle' ? s.battle : null;
  if (!b || !s.pendingFall || !s.scene) return null;
  const c = garanti(inBattleId(b, tombantId), tombantId, 'sauteur');
  const cout = mouvementDeLaChute(s.pendingFall, true, sceneMetresPerTile(s.scene));
  return movementRemaining(b, c) < cout ? refus('fall.suspension.mouvementInsuffisant', trous({ name: c.label, cout })) : null;
}

/** Le mobile peut-il accomplir un geste déplaçant MAINTENANT ? (sélecteur de store, valeur primitive). */
export function gestesDeplacantsOuverts(s: Jeu): boolean {
  return !('refus' in gesteDArete(s));
}

/**
 * Atterrissage d'une chute VOLONTAIRE (LDB 15 l.82 ; EDO 01 l.231) : chaque TOMBANT subit SA hauteur —
 * chute pleine (`metresRetenus`) sans Test, `effectiveMetres` du Test sinon ; à 0 m ou moins, AUCUN Dégât
 * (bypass EXPLICITE : `applyFall(c,0,rng)` ne garantit PAS 0 dégât seul, cf. son d10). Le Test TENTÉ
 * consomme l'Action (LDB 13 l.86-88, patron `climbAcross` « surface »). Exploration : le PAS du groupe
 * (`poserLeGroupe`, ses déclencheurs) d'abord, puis une chute par tombant ; combat : le seul tombant.
 */
function settleFall(get: Get, set: Set, p: PendingFall): void {
  const { scene, mode, battle } = get();
  set({ pendingFall: null });
  if (!scene) return;
  const pool = mode === 'battle' ? (battle?.combatants ?? []) : get().party;
  const chutes = p.participants.flatMap((part) => {
    const c = pool.find((x) => x.id === part.id);
    const m = part.attempt ? part.result?.effectiveMetres : metresRetenus(p, part);
    return c && m !== undefined ? [{ c, m: Math.max(0, m) }] : [];
  });
  // Le tour se solde À LA TENTATIVE (LDB 13 l.86-88 : c'est le Test tenté qui consomme l'Action), donc
  // AVANT l'atterrissage : ce coût ne dépend pas de ce que dira le 1d10 de chute (#1508). Combat : le
  // seul tombant est l'initiateur, son Mouvement est `mouvementDeLaChute`.
  const initiateur = p.participants.find((x) => x.id === p.initiateurId);
  soldeDeLAction(get, set, p.participants.some((x) => x.attempt === true), mouvementDeLaChute(p, initiateur?.suspendre === true, sceneMetresPerTile(scene)));
  if (mode === 'battle') {
    for (const { c, m } of chutes) {
      if (m > 0) jouerFlowEntier(applyEffects(get, set, [{ type: 'fall', target: 'hero', heroId: c.id, metres: m, to: p.to }]));
      else { placeCombatant(c, scene, p.to); get().log(t('fall.jumpSafe', { name: c.label })); }
    }
    return;
  }
  poserLeGroupe(get, set, { ...p.to });
  // Les 1d10 de TOUS les tombants s'ouvrent ENSEMBLE (`ouvrirChute`, patron de l'Effet `fall` à plusieurs
  // cibles et de `collapseStructure`) : la séquence compte d'emblée chaque dé de la chute.
  for (const { c, m } of chutes) {
    if (m > 0) {
      get().log(t('eff.fallOuverte', { m, noms: c.label }));
      ouvrirChute(set, c, m);
    } else get().log(t('fall.jumpSafe', { name: c.label }));
  }
}

/** Les TOMBANTS d'une chute volontaire : combat = l'actif seul ; exploration = le groupe
 *  (`effectTargets('party')`), l'initiateur en tête. */
function tombantsDe(get: Get, battle: BattleState | null, initiateur: Combatant): Combatant[] {
  if (battle) return [initiateur];
  const groupe = effectTargets(get, 'party');
  return [initiateur, ...groupe.filter((c) => c.id !== initiateur.id)];
}

/** La case d'arrivée d'un franchissement (`planFranchissement`) est-elle interdite au mobile en combat ?
 *  Transit bloqué OU arrêt interdit — les deux ensembles du `MoveEnv` (on ne finit jamais sur une autre
 *  créature, `combatGeometry.ts:cannotStopOn`). */
function arriveeOccupee(battle: BattleState, mover: Combatant, to: Pt): boolean {
  const env = moveEnv(battle, mover);
  const k = tileKey(to.x, to.y, to.z ?? 0);
  return env.blocked.has(k) || !!env.noStop?.has(k);
}

/** SOLDE de l'Action/du Mouvement d'un tour à la tentative de saut (`settleFall`) — nommé pour être
 *  joué AVANT l'atterrissage, là où il ne dépend d'aucun dé (LDB 13 l.86-88). `mouvement` = cases
 *  dépensées (`mouvementDeLaChute`). */
function soldeDeLAction(get: Get, set: Set, actionSpent: boolean, mouvement: number): void {
  const bB = get().battle;
  if (get().mode === 'battle' && bB) {
    set({ battle: { ...bB, acted: actionSpent ? true : bB.acted, action: null, movementUsed: (bB.movementUsed ?? 0) + mouvement, movedPreAction: bB.movedPreAction || !bB.acted, reachable: new Map(), preview: null } });
  }
  bus.emit(EVT.SCENE_DIRTY);
}

export function creerActionsDeFranchissement(get: Get, set: Set) {
  return {
    climbAcross: (from, to) => {
      const verdict = gesteDepuis(get(), from);
      if ('refus' in verdict) return void refuserGeste(get, set, t(verdict.refus, verdict.vars));
      const { mobile: mover, scene, battle } = verdict;
      // Grimpeur (LDB 15 l.57) : porté par le mobile du geste (`gesteDArete`). Grimpant
      // (LDB 85 l.160-162, créature, combat seulement) : `autoClimb` dispense de tout Test — et de la garde
      // `requiresGrimpeur`, réservée au Talent joueur (`planClimb` arbitre `autoSucceed`, réf ci-dessous).
      const hasGrimpeur = !!mover.talents?.some((tl) => tl.talentId === 'grimpeur' && tl.times > 0);
      const autoClimb = !!battle && hasAutoClimb(mover.traits);
      const plan = planClimb(scene, from, to, hasGrimpeur, battle ? mover.id : undefined, autoClimb);
      if (!plan) return void refuserGeste(get, set, t('climb.pasGrimpable'));
      if (plan.kind === 'impossible') return void refuserGeste(get, set, t('climb.tooHard', { name: mover.label }));
      if (!isWalkable(scene, to.x, to.y, to.z ?? 0)) return void refuserGeste(get, set, t('climb.sommetInaccessible', { name: mover.label }));
      if (!battle) {
        poserLeGroupe(get, set, to); // monte (optimiste) ; l'échec du Test fera chuter au pied via l'Effet `fall`
        if (plan.kind === 'test') jouerFlowEntier(runFlow(get, set, plan.flow));
        return;
      }
      const metres = Math.abs(heightAt(scene, to.x, to.y, to.z ?? 0) - heightAt(scene, from.x, from.y, from.z ?? 0));
      // Grimpant `climbFullSpeed` (LDB 85 l.162) : coût NORMAL (1 case), pas la ½ vitesse du Talent
      // Grimpeur joueur (LDB 15 l.55, `climbMovementCost`) — chemin joueur strictement inchangé.
      const cost = hasClimbFullSpeed(mover.traits) ? 1 : climbMovementCost(metres, sceneMetresPerTile(scene));
      if (movementRemaining(battle, mover) < cost) return void refuserGeste(get, set, t('climb.mouvementInsuffisant', { name: mover.label, cout: cost }));
      // `surface` = Test requis → consomme l'Action (LDB 13 l.86-88) ; `ladder`/`auto` = sans Test → Mouvement seul.
      if (plan.kind === 'test' && battle.acted) return void refuserGeste(get, set, t('climb.actionDejaPrise', { name: mover.label }));
      if (arriveeOccupee(battle, mover, to)) return void refuserGeste(get, set, t('franchir.caseOccupee', { name: mover.label }));
      placeCombatant(mover, scene, to); // hisse (optimiste) ; échec du Test → `fall` au pied
      const acted = plan.kind === 'test' ? true : battle.acted;
      // Résolution directe (Grimpant) : PAS un jet silencieux — il n'y a PAS de jet du tout, journalisé.
      const log = plan.kind === 'free' && plan.auto
        ? [...battle.log, ev('move', t('climb.auto', { name: mover.label }), mover.id)]
        : battle.log;
      set({ battle: { ...battle, log, acted, action: null, movementUsed: (battle.movementUsed ?? 0) + cost, movedPreAction: battle.movedPreAction || !battle.acted, reachable: new Map(), preview: null } });
      bus.emit(EVT.SCENE_DIRTY);
      // Lanceur = le mobile (`actorId`), LDB 15 l.57.
      if (plan.kind === 'test') openSkillTest(get, set, plan.flow.test, plan.flow.success, plan.flow.fail, EMPTY_FLOW, { actorId: mover.id });
    },
    /** Chute VOLONTAIRE (LDB 15 l.82) : depuis `from` (case du sauteur) vers `to` (case cardinale plus
     *  basse, `planFranchissement`) — geste JOUEUR seulement (IA hors périmètre : elle ne saute jamais). Ouvre le
     *  choix pré-jet `pendingFall` (Sauter / Tenter, et se suspendre d'abord quand la croisée l'offre),
     *  résolu par `fallChoose`. Le Mouvement que `soldeDeLAction` imputera (`mouvementDeLaChute`) est
     *  vérifié ici (le pas, l'allège) et à la déclaration (la suspension, `refusDeLaSuspension`). */
    fallAcross: (from, to) => {
      const verdict = gesteDepuis(get(), from);
      if ('refus' in verdict) return void refuserGeste(get, set, t(verdict.refus, verdict.vars));
      const { mobile: mover, scene, battle } = verdict;
      const plan = planFranchissement(scene, from, to);
      if (plan.kind !== 'fall') return void refuserGeste(get, set, t(plan.kind === 'none' ? REFUS_FRANCHISSEMENT[plan.raison] : 'franchir.refus.pasUneChute'));
      if (battle && arriveeOccupee(battle, mover, plan.to)) return void refuserGeste(get, set, t('franchir.caseOccupee', { name: mover.label }));
      // Le pas, et l'allège d'une croisée (`mouvementDeLaChute`, patron `windowAcross`).
      const cout = mouvementDeLaChute(plan, false, sceneMetresPerTile(scene));
      if (battle && movementRemaining(battle, mover) < cout) return void refuserGeste(get, set, t('fall.mouvementInsuffisant', { name: mover.label, cout }));
      const tombants = tombantsDe(get, battle, mover);
      // Membre VIVANT non debout : maison `chute-tombant-non-debout` (EDO 01 l.231, LDB 15 l.82).
      const nonDebout = tombants.find((c) => !estDebout(c));
      if (nonDebout && rule('chute-tombant-non-debout') !== 'chute-pleine') return void refuserGeste(get, set, t('fall.refus.nonDebout', { name: nonDebout.label }));
      set({
        pendingFall: {
          test: testDeRegle('chute', 'tenter'),
          to: plan.to, metres: plan.metres, initiateurId: mover.id,
          ...(plan.suspendu !== undefined ? { suspendu: plan.suspendu } : {}),
          ...(plan.allege !== undefined ? { allege: plan.allege } : {}),
          participants: tombants.map((c) => (estDebout(c)
            ? { id: c.id, interactive: true, attempt: null, ...(plan.suspendu !== undefined ? { suspendre: null } : {}), result: null }
            : { id: c.id, interactive: false, attempt: false, ...(plan.suspendu !== undefined ? { suspendre: false } : {}), result: null })),
        },
        ...(battle ? { battle: { ...battle, action: null, preview: null } } : {}),
      });
    },
    fallChoose: (tombantId, attempt, suspendre) => {
      // Un intent coop PÉRIMÉ (double clic d'un invité, saut déjà résolu) arrive jusqu'ici : refus nommé.
      const p = get().pendingFall;
      if (!p) return void refuserGeste(get, set, t('fall.refus.aucunSaut'));
      const part = p.participants.find((x) => x.id === tombantId);
      if (!part) return void refuserGeste(get, set, t('fall.refus.horsDuSaut', { id: tombantId, tombants: tombantsNommes(get(), p.participants.filter((x) => x.interactive)) }));
      if (part.attempt !== null) return void refuserGeste(get, set, t('fall.refus.dejaDeclare'));
      // Axe HAUTEUR (EDO 01 l.231) : déclaré avec le saut quand la suspension est offerte, jamais sinon.
      const offerte = p.suspendu !== undefined;
      if (offerte !== (suspendre !== undefined)) return void refuserGeste(get, set, t(offerte ? 'fall.refus.suspensionOfferte' : 'fall.refus.axeHauteur'));
      if (attempt) {
        const refus = refusDuTestDeChute(get(), tombantId);
        if (refus) return void refuserGeste(get, set, t(refus.refus, refus.vars));
      }
      if (suspendre) {
        const refus = refusDeLaSuspension(get(), tombantId);
        if (refus) return void refuserGeste(get, set, t(refus.refus, refus.vars));
      }
      const suite: PendingFall = { ...p, participants: p.participants.map((x) => (x.id === tombantId ? { ...x, attempt, ...(offerte ? { suspendre } : {}) } : x)) };
      // Toutes les rangées sautent SANS Test (RAW « vous pouvez tenter ») : rien à lancer, l'étape se résout.
      if (suite.participants.every((x) => x.attempt === false)) { settleFall(get, set, suite); return; }
      set({ pendingFall: suite });
    },
    fallConfirm: () => {
      const p = get().pendingFall;
      if (!p) return void refuserGeste(get, set, t('fall.refus.aucunSaut'));
      const refus = refusDesRangeesDues(get(), p);
      if (refus) return void refuserGeste(get, set, refus);
      settleFall(get, set, p);
    },
    fallCancel: () => set({ pendingFall: null }),
    windowAcross: (from, to) => {
      const verdict = gesteDepuis(get(), from);
      if ('refus' in verdict) return void refuserGeste(get, set, t(verdict.refus, verdict.vars));
      const { mobile: mover, scene, battle } = verdict;
      const plan = planFranchissement(scene, from, to);
      if (plan.kind !== 'enjamber') return void refuserGeste(get, set, t(plan.kind === 'none' ? REFUS_FRANCHISSEMENT[plan.raison] : 'franchir.refus.pasDePlainPied'));
      if (!battle) {
        bus.emit(EVT.ANIM_MOVE, { id: mover.id, path: [verdict.case, plan.to] });
        poserLeGroupe(get, set, plan.to);
        return;
      }
      const cout = 1 + mouvementDeLAllege(plan.allege, sceneMetresPerTile(scene));
      if (movementRemaining(battle, mover) < cout) return void refuserGeste(get, set, t('fenetre.mouvementInsuffisant', { name: mover.label, cout }));
      if (arriveeOccupee(battle, mover, plan.to)) return void refuserGeste(get, set, t('franchir.caseOccupee', { name: mover.label }));
      placeCombatant(mover, scene, plan.to);
      const log = [...battle.log, ev('move', t('fenetre.enjambe', { name: mover.label }), mover.id)];
      set({ battle: { ...battle, log, action: null, movementUsed: (battle.movementUsed ?? 0) + cout, movedPreAction: battle.movedPreAction || !battle.acted, reachable: new Map(), preview: null } });
      bus.emit(EVT.SCENE_DIRTY);
    },
  } satisfies Partial<ActionsDuNoyau>;
}
