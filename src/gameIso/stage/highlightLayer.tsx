/**
 * Les vérités du STORE qu'une surbrillance de combat demande (portées, cibles éligibles, candidats du
 * mode de ciblage, bandes de portée du tireur survolé), assemblées UNE fois en `HighlightsView` — ce
 * que le builder pur (`builders/highlights`) consomme, et par lui le monde volumique
 * (`stage/VolumetricWorld` → `backends/webgl/highlightMeshes`).
 * Aucune projection ici : cette couche ne connaît ni caméra ni couleur.
 */
import type { GameState } from '../../state/store';
import type { BattleState } from '../../noyau/etat';
import type { PendingAttack, PendingCleave, PendingDualStrike, PendingCast } from '../../noyau/pendings';
import { Combatant } from '../../engine/types';
import { crowdEligible, eligibleAttackTargetIds, displayedReach, computeRunReach } from '../../noyau/combatFlow';
import { hasFreeWeaponAttack } from '../../noyau/combatManeuvers';
import { currentTargetingMode } from '../../noyau/targetingModes';
import { armedIntentPortee, courseArmee, intentReach, PORTEE_ARME, type LocalIntent } from '../../noyau/localIntent';
import { controlsCombatant } from '../../noyau/netOwnership';
import { inBattleId } from '../../noyau/monde/combatants';
import { attackWeapon } from '../../engine/combat';
import { effectiveWeaponRange } from '../../engine/weaponDamage';
import { loadedAmmo } from '../../engine/items';
import { bonus, effectiveChar } from '../../engine/characteristics';
import type { HighlightsView } from '../builders/highlights';

export interface HighlightOpts {
  myTurn: boolean;
  pendingAttack: PendingAttack | null;
  /** Flux différés qui TIENNENT le ciblage (`noyau/targetingHolder`) — ils vivent à la racine du store,
   *  hors `battle` : le contexte les porte pour que l'écran déjà monté réapprenne leur changement
   *  (même raison que `localIntent`/`hovered`). Le VERDICT, lui, se lit au mode courant
   *  (`currentTargetingMode`), jamais à une 2ᵉ liste de priorités recopiée ici. */
  pendingCleave: PendingCleave | null;
  pendingDualStrike: PendingDualStrike | null;
  pendingCast: PendingCast | null;
  /** INTENTION ARMÉE (`noyau/localIntent`) — elle vit à la RACINE du store, hors `battle` : c'est par
   *  ce contexte que l'hôte fait savoir au monde qu'elle a changé. Sa PORTÉE, elle, se lit à sa source
   *  unique (`intentReach`). */
  localIntent: LocalIntent | null;
  /** Combattant SURVOLÉ (`store.hovered`, frise ou token) — même raison : c'est lui qui allume les
   *  bandes de portée d'un tireur, et il vit hors `battle`. */
  hovered: string | null;
}

export function combatHighlightsView(get: () => GameState, battle: BattleState, opts: HighlightOpts): HighlightsView {
  const { myTurn, pendingAttack, pendingCast, localIntent, hovered } = opts;
  const activeC = inBattleId(battle, battle.order[battle.turn]);
  // COOP : le tour du héros d'un AUTRE joueur s'affiche comme un tour ennemi — aucune affordance
  // (ni grille de déplacement, ni anneaux de cible, ni aperçu) ; teintes d'équipe/zones restent.
  // (Plus AUCUN indicateur de distance au sol — la portée se lit au survol : réticule = cible valide.)
  const view: HighlightsView = {
    myTurn,
    walkReach: myTurn ? displayedReach(get) : new Map<string, number>(),
    // ZONE DE COURSE : peinte SEULEMENT quand la Course est ARMÉE (spec HUD § ARBITRAGE 2026-08-19,
    // « par défaut seule la zone de déplacement est affichée »). C'est aussi l'affichage de cette
    // intention-là : `INTENT_REACH['portee-course']` délègue ICI plutôt que de peindre une 2ᵉ fois la
    // même vérité en nature `intent` (même patron que la portée d'ARME → `rangeBandSource`).
    runReach: myTurn && courseArmee(get) ? computeRunReach(get) : new Map<string, number>(),
    // INTENTION armée depuis l'interface : sa portée est LOCALE au client (hors `battle`) et ne
    // s'affiche qu'à son tour, comme toute affordance (spec HUD zone 4).
    intentReach: myTurn && localIntent ? intentReach(get) : new Map<string, number>(),
    activeId: activeC?.id ?? null,
    // Anneaux d'attaque (R4) : en mode neutre (attaque implicite), tant que l'Action est disponible
    // (ou attaque libre de Frénésie).
    eligibleIds:
      myTurn && battle.action === null && !!activeC && controlsCombatant(get(), activeC) && !pendingAttack && (!battle.acted || hasFreeWeaponAttack(activeC))
        ? eligibleAttackTargetIds(get)
        : null,
    crowdIds: (() => {
      if (!pendingAttack?.intoCrowd) return null;
      const atk = battle.combatants.find((c) => c.id === pendingAttack.attackerId);
      const tgt = battle.combatants.find((c) => c.id === pendingAttack.targetId);
      return atk && tgt ? new Set(crowdEligible(battle, atk, tgt).map((v) => v.id)) : null;
    })(),
    // Cibles cliquables du MODE de ciblage courant (targetingModes → MÊME source que réticule/clic).
    // C'est le MODE qui DÉCLARE s'il peint ses candidats et de quelle teinte (`anneauCandidats`) : rien
    // ici ne nomme un flux ni un id d'action. Les `pending*` du contexte restent le signal de fraîcheur
    // de l'hôte (cf. `HighlightOpts`) — l'aiguilleur, lui, les relit à leur source.
    candidates: (() => {
      if (!myTurn || pendingAttack) return null;
      const tmode = currentTargetingMode(get);
      if (!tmode.anneauCandidats) return null;
      const cands = activeC ? tmode.candidates?.(get, activeC) ?? [] : [];
      return {
        ids: cands.map((c: Combatant) => c.id),
        friendly: tmode.anneauCandidats === 'ami',
        checkedIds: pendingCast?.pickingTargets ? new Set(pendingCast.extraTargetIds ?? []) : null, // surincantation : déjà coché
      };
    })(),
    // Bandes de portée du tireur SURVOLÉ (frise ou token, `store.hovered` — même source que le halo de
    // survol) : arme à DISTANCE équipée en main → cases à colorer autour de sa position.
    rangeBandSource: (() => {
      // L'INTENTION d'attaque (spec HUD zone 4, G1) montre la PORTÉE DE L'ARME du set : elle n'ouvre
      // pas un 2ᵉ dessin de cette vérité — elle allume les bandes de tir existantes autour de l'ACTIF,
      // sans attendre un survol. Le survol garde la priorité (il désigne un autre tireur).
      const armedAttack = myTurn && localIntent && armedIntentPortee(get) === PORTEE_ARME ? activeC ?? null : null;
      const c = battle.combatants.find((x) => x.id === hovered) ?? armedAttack;
      if (!c?.pos) return null;
      const weapon = attackWeapon(c.weapons, false);
      if (!weapon || weapon.type !== 'ranged') return null; // structure/décor sans arme (porte…) — pas de bande (#203 régression)
      const rangeM = effectiveWeaponRange(weapon, loadedAmmo(c, weapon)?.ammoRangeMod, () => bonus(effectiveChar(c, 'force')));
      return rangeM != null ? { pos: c.pos, rangeM } : null;
    })(),
  };
  return view;
}

/**
 * Le combattant SURVOLÉ porte-t-il des BANDES DE PORTÉE (arme à distance en main) ? Renvoie son id, ou
 * `null` — c'est-à-dire : ce survol change-t-il quoi que ce soit aux marques de cases ?
 *
 * SOURCE UNIQUE de ce verdict, à DEUX usages : la vue ci-dessus s'en sert pour choisir sa source, et
 * l'hôte (`IsoStage`) pour ne faire entrer dans son contexte que les survols qui PEIGNENT. Sans ce
 * filtre, survoler n'importe qui reforgeait la liste entière des marques et faisait réécrire tous les
 * pools d'instances pour une image identique (garde `marques-en-place`, #1176 P3-0c).
 */
export function tireurSurvole(battle: BattleState, hovered: string | null): string | null {
  const c = inBattleId(battle, hovered ?? undefined); // primitive canonique du find-par-id EN COMBAT (cliquet #279)
  if (!c?.pos) return null;
  const weapon = attackWeapon(c.weapons, false);
  return weapon?.type === 'ranged' ? c.id : null;
}
