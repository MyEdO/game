/**
 * Registre des MODES de ciblage de combat — SOURCE UNIQUE de « pour l'action courante → quelles
 * cibles (combattant ou case) → quel réticule → que fait le commit ». Chaque mode (attaque, cast,
 * soin, surincantation, zone, téléportation, piétinement, au-contact, empoignade, bordée, siège,
 * Frappe Mortelle, deux armes) répond à CE besoin unique ; `currentTargetingMode(get)` est
 * l'aiguilleur. Les facettes (réticule au survol / cibles Tab-curseur / commit) qui vivaient à
 * trois endroits (targeting.ts, combatSlice.ts, la surcouche de plateau) sont ICI, unifiées.
 *
 * CONTRAT D'AFFICHAGE (arbitrage utilisateur 2026-08-24, verbatim : « Dans RT, mettre sa souris sur un
 * ennemi ou une case hors porté ca n'affiche rien de particulier ») : LE SURVOL N'AFFICHE QUE LE
 * FAISABLE — une affordance `ok` porte le réticule et la carte de jet, une affordance `invalid` ne
 * rend RIEN. L'INFAISABLE SE DIT AU CLIC, par `refuserGeste` (`noyau/refusVisible`), au point du geste.
 *
 * Importe combatFlow, qui l'atteint en retour par combatOrParty (`touchActors`…) : un cycle de modules
 * que seuls des appels de fonction traversent, jamais une valeur lue au chargement. Consommé par
 * targeting.ts, combatSlice.ts, combatCursor.ts, combatOrParty.ts.
 */
import type { IdDeModeDeCiblage } from '../data/schemas/defs/actions';
import type { Get, Set } from './flowTypes';
import type { ActionDeClasse } from './intentionsDeSiege';
import type { Combatant } from '../engine/types';
import type { DifficultyShown } from '../engine/combat';
import { ciblesBasculees } from './reglagesDuJet';
import { attackTestLabel, isHelplessTarget, rangeBandModifier } from '../engine/combat';
import { castInfo, incantationArcane, isMagicMissile, missileDamage, focalisationAboutie } from '../engine/magic';
import { bonus, bonusDeForce, effectiveChar } from '../engine/characteristics';
import { effectiveRange } from '../engine/weaponDamage';
import { isOutOfAction, refusVerrouDAction } from '../engine/conditions';
import { refusActionDepensee, refusHorsDEtatDAgir, refusPriereImposee } from './refusDuTour';
import { isEngaged, reachTiles } from '../engine/engagement';
import { avantageApresDepense, campSpend } from './combat/advantagePool';
import { hasActiveFlag } from '../engine/activeFlags';
import { isFrenzied } from '../engine/psychology';
import { healableTargets, modesDOuverture, soinDOuverture } from '../engine/healing';
import { libelleDeTest } from './jetsEnVue';
import { garanti } from '../lib/garanti';
import { dispellableSpellsOn, type DispellableSpell } from '../engine/dispel';
import { findSpellById, testSkillLabel } from '../data';
import { isStructure, structureImmune } from '../engine/structures';
import { overcastSourceOf } from '../engine/overcast';
import { tileKey, type Pt } from './monde/path';
import { sceneMetresPerTile } from './monde/scene';
import { distanceDeCombat, distanceDeContact } from './monde/footprint';
import { targetArc } from './monde/fireArc';
import { bearingPostes } from './monde/shipBattery';
import { serveTargetPoste, isPosteManned, translaterFormation, posteDeLaBataille } from './monde/shipPostes';
import { spellOps } from '../engine/flowCore';
import { mountOf, mountMovement, attackGeomOf, combatGeomOf, pickAttackWeapon } from './mount';
import { pilotedByHuman } from './netOwnership';
import { inBattleId } from './monde/combatants';
import { detenteurDuCiblage } from './targetingHolder';
import { approachMs } from './combatDirector';
import { ev } from './combatLog';
import { refuserGeste, refuserGesteDuSiege } from './refusVisible';
import { chargeArmee, intentionLocale } from './localIntent';
import { t, type MsgKey } from '../i18n';
import type { PlayerText } from '../i18n/playerText';
import { bus, EVT } from './bus';
import type { Jeu } from './etat';
import { chebyshev } from '../engine/grid';
import {
  attackPlan, previewAttack, previewCast, firedAttackBlock, outOfSightTargetIds, castOutOfSightTargetIds, retenuParLaPeur, frenzyTarget, noteApproachMove, placingZoneOf, placedZoneValidAt, commitPlacedZone, overcastTargetCandidates, cleaveTargets, dualStrikeTargets, castZoneSpell, castSpell, spellSightOf, firedWeapon, armeDeLaGratuite, difficultyOf, activeCombatant, castTargetBlock, armerLaSuite, declarerLaCharge, type AttackPreview, type AttackPlan,
} from './combatFlow';
import { selectedAttackOption, freeAttackTargetOk, auContactEligible, grappleActionEligible, type AttackOption } from './combatManeuvers';
import { captureMoveSnapshot, campAuContact } from './monde/combatGeometry';
import { displaceSmaller, applyZoneCrossings } from './combatPlacement';
import { placeCombatant } from './monde/spawn';
import type { IdDIntention } from './designations';

export type HoverTargeting =
  | { kind: 'none' }
  /** Cible refusée au clic — le SURVOL n'en rend RIEN (arbitrage 2026-08-24) : la raison sert au CLIC,
   *  qui la dit par `refuserGeste`. `engaged` = mêlée verrouillée par l'Engagement (Désengagement
   *  requis) ; `unloaded` = arme à Recharge non chargée (recharger d'abord) ; `noammo` = plus de
   *  munition ; `sous-effectif` = machine de guerre ADE II sous la moitié de l'Équipe requise
   *  (ch.08 l.233) ; `approche-non-armee` = hors de portée ET la Charge n'est pas armée (spec HUD
   *  § 2026-08-19) ; `sans-sort-dissipable` = mode Dissiper armé, mais la cible ne porte aucun Sort
   *  permanent (LDB 46 l.158-162) ; `hors-d-etat` = le porteur ne peut agir (LDB 16 l.125) ou un État
   *  verrouille son Action (LDB 16 l.52) ; `frenesie-cible` = la Frénésie impose une autre cible (LDB 21
   *  l.33) ; `cible-gratuite` = cible hors de ce que la gratuite armée admet ; `action-depensee` = l'approche
   *  d'une attaque qui coûte l'Action, l'Action dépensée. */
  | { kind: 'invalid'; reason: 'los' | 'range' | 'engaged' | 'unloaded' | 'noammo' | 'arc' | 'sous-effectif' | 'portee-min' | 'armeBannie' | 'approche-non-armee' | 'sans-sort-dissipable' | 'hors-d-etat' | 'frenesie-cible' | 'cible-gratuite' | 'action-depensee' }
  /** Mode Soin armé : allié soignable à portée, mais aucun soin de combat ne s'offre (`modesDOuverture`). */
  | { kind: 'invalid'; reason: 'sans-soin-de-combat' }
  | {
      kind: 'ok';
      /** Style de la ligne de visée : pointillée (tir/sort) ou pleine (mêlée, déplacement compris). */
      line: 'dashed' | 'solid';
      /** Nom de l'arme ou du sort. */
      title: string;
      /** Libellé de la compétence employée (« Projectiles (Arcs) », « Langue (Magick) »…). */
      skill: string;
      /** Valeur de compétence NUE, et l'écart `base → cible` que le réticule affiche à côté : `mod`
       *  couvre TOUT ce qui sépare les deux — modificateurs situationnels, Difficulté, plafond des
       *  Difficultés et écrêtage de la cible (peut être 0). */
      base: number;
      mod: number;
      /** Dégâts AVANT le DR du jet (arme : Force incluse ; Projectile magique : sort + BFM). null = sans dégâts (buff). */
      dmg: number | null;
      /** Chemin RÉEL du déplacement combiné (Charge / rejoindre) — tracé au survol à la place de la ligne droite. */
      path?: { x: number; y: number }[];
      /** Difficulté que dira le jet de ce geste (`difficultyOf` sur l'aperçu qui a fait `base`/`mod`) :
       *  le cran de l'échelle, ou le modificateur combiné quand elle n'en atteint aucun. */
      difficulty?: DifficultyShown;
    };

/** Aperçu d'un mode à ciblage TUILE (#198) — au survol souris/curseur clavier d'une case VALIDE
 *  (`tileValidAt` déjà vrai). `target` ancre le réticule (case d'arrivée / centre de zone) ; `path`
 *  (facultatif, ≥2 points) trace la direction depuis l'origine ; `cost` porte la distance/le coût
 *  affiché ; `label` est le texte du badge (rendu par `movePreviewEls`, MÊME primitive que l'aperçu de
 *  déplacement normal — pas de nouveau système visuel). */
export interface TilePreview {
  target: Pt;
  path?: Pt[];
  cost?: number;
  label: string;
}

/**
 * Un MODE de ciblage. Un mode-COMBATTANT remplit `affordance` (réticule au survol) + `commitCombatant`
 * (clic-token) ; un mode-CASE remplit `tileValidAt` + `commitTile` (clic-sol) + `tilePreview` (aperçu au
 * survol — voir `TileTargetingMode` ci-dessous, qui rend les trois REQUIS pour un mode-case : la garde
 * structurelle du ticket #198, un mode-case sans aperçu ne compile pas). `candidates` (Tab/curseur) vaut
 * par défaut « les combattants dont l'affordance est 'ok' » — un mode ne le surcharge que s'il a une
 * liste propre (soin, surincantation…). Tout est PUR (lit l'état) sauf les commit (mutent via set).
 */

export interface TargetingMode {
  id: IdDeModeDeCiblage;
  /** Nom d'AFFICHAGE de la phase de ciblage, quand ce mode est un INTERLUDE (ciblage par la carte
   *  sans modale : Frappe Mortelle, 2ᵉ frappe, Surincantation, pose de zone, bordée, téléportation).
   *  Rendu par le bandeau de phase de la console — la SORTIE, elle, vit au registre des actions
   *  (`surface: 'interlude'`). Absent = mode ordinaire, aucun bandeau. */
  label?: string;
  /** CONSIGNE de la phase : ce que la carte attend du joueur (clé du catalogue `src/i18n`), rendue par
   *  le MÊME bandeau que `label`. Absente = mode sans bandeau. */
  consigne?: MsgKey;
  affordance?(get: Get<Jeu>, active: Combatant, target: Combatant): HoverTargeting;
  candidates?(get: Get<Jeu>, active: Combatant): Combatant[];
  /** Les `candidates` de ce mode sont-ils PEINTS en anneaux sur le terrain quand il tient le ciblage,
   *  et de quelle TEINTE ? `'ami'` = la cible élue est un allié (anneau vert : Soin) ; `'hostile'` =
   *  un adversaire. Absent = ce mode ne peint aucun anneau de candidat (l'attaque en mode neutre a les
   *  siens, `validTargets` ; Dissiper n'en peint pas). SÉMANTIQUE D'AFFICHAGE déclarée au
   *  mode — le peintre (`gameIso/stage/highlightLayer` → `builders/highlights`) ne connaît aucun id. */
  anneauCandidats?: 'ami' | 'hostile';
  commitCombatant?(get: Get, set: Set, active: Combatant, id: string, opts?: BattleClickOpts): void;
  /** Ce clic-token, sur CETTE cible, n'ouvre-t-il qu'un CHOIX D'ÉCRAN — le paramètre borné qui reste
   *  à demander — sans rien commettre au jeu ? PUR. Vrai = le geste se joue ENTIER chez l'ÉMETTEUR :
   *  `netFlow` ne l'envoie pas à l'hôte (`INTENT_ELECTION_LOCALE`), au même titre que l'intention
   *  armée est un mode d'écran qui ne voyage pas. Absent = tout clic de ce mode est un geste de jeu. */
  electionLocale?(get: Get, id: string): boolean;
  tileValidAt?(get: Get<Jeu>, active: Combatant, pt: Pt): boolean;
  commitTile?(get: Get, set: Set, active: Combatant, pt: Pt): void;
  tilePreview?(get: Get<Jeu>, active: Combatant, pt: Pt): TilePreview | null;
}

/** Mode-CASE COMPLET : `tileValidAt`/`commitTile`/`tilePreview` tous requis — un mode qui cible des
 *  tuiles (catalogue `TILE_MODES`) DOIT fournir son aperçu, sinon erreur de compilation (#198). */
export type TileTargetingMode = TargetingMode & Required<Pick<TargetingMode, 'tileValidAt' | 'commitTile' | 'tilePreview'>>;

/**
 * Les options que le clic d'une case porte (`cliquerLaCase`) : la confirmation de l'émetteur, et l'intention que le clic
 * commet (`intentionId`, spec HUD § ARBITRAGE 2026-08-19), d'où le receveur dérive la Charge et la Course et dont il juge
 * l'offre (`localIntent.intentionDuClic`). Elle voyage avec le geste :
 *  - COOP : l'intention est locale au CLIENT (`localIntent`, hors snapshot) ; l'émetteur la joint
 *    (`localIntent.INTENTION_JOINTE_AUX_ARGS`) ;
 *  - RÉ-ENTRÉE : un geste différé par un gate (Test `calme-d-approche`, Bénédiction de Protection, choix cavalier/monture)
 *    est rejoué quand le premier clic a dissous l'intention ; elle voyage donc DANS le pending.
 * Absente : l'intention locale du propriétaire du store.
 */
export type OptionsDuClic = { confirm?: boolean; intentionId?: IdDIntention };

/** Options du clic d'un combattant (`cliquerLeCombattant`) : celles du clic, et les sauts de portail d'une relance dans
 *  le noyau (`skipMountChoice`, `wardCleared`). */
export type BattleClickOpts = OptionsDuClic & { skipMountChoice?: boolean; wardCleared?: boolean };

/** Ops « cible » qui rendent un sort OFFENSIF → ciblable sur un ennemi (réticule + interdit hors portée,
 *  comme le tir). Tous les États WFRP sont négatifs (`condition`) ; `wounds` = Dégâts. Liste tenue
 *  COMPLÈTE côté offensif : un offensif oublié = sort injouable sur l'ennemi (le bug d'origine). */
const HARMFUL_TARGET_OPS = new Set<string>([
  'condition', 'wounds', 'corruption', 'lifeSteal', 'suffocate', 'senseLoss', 'loseTurn',
  'breakBlade', 'damageArmour', 'damageWornGear', 'armourPierce', 'reduceToZero', 'castPenalty', 'suppressTalents',
  'deityBan', 'prayerForAction',
]);
/** Ops « cible » BÉNÉFIQUES-SANS-AMBIGUÏTÉ → buff sur allié/soi. Liste tenue EXHAUSTIVE au même titre
 *  que HARMFUL_TARGET_OPS (recensement du catalogue `GameOp`, engine/ops.ts) POUR LES OPS DONT LE SIGNE
 *  EST FIXE (soin, purge d'État/maladie/psy, octroi, protection…) : asymétrie ASSUMÉE avec HARMFUL —
 *  un offensif oublié rend un sort injouable sur l'ennemi (bug réel, HARMFUL doit rester complète) ;
 *  un bénéfique-clair oublié ici ne fait que retomber en 'tout' (réticule des deux côtés, jamais caché).
 *  Les ops DUAL-SIGNE (`testMod`/`skillMod`/`attrMod`/`charDRBonus`/`sinMod`/`maxWeaponHands`… — la
 *  MÊME op est un buff OU un malus selon `amount`/`mod`/`hands`) sont VOLONTAIREMENT absentes : 'tout'
 *  est le comportement voulu, jamais 'allie' pour un malus déguisé (Malédiction de malchance, testMod
 *  amount:-10, LDB 49 l.62 — verrouillé par le test dual-signe de targetingModes.hors-store.test.ts). */
const HELPFUL_TARGET_OPS = new Set<string>([
  'ap', 'heal', 'cureCriticalWound', 'cureDisease', 'removeCondition', 'grantTrait', 'grantTalent',
  'grantWeapon', 'grantNaturalWeapon', 'grantFreeAttack', 'augmentWeapon', 'giveTrapping', 'freeReroll',
  'gainResource', 'arrowWard', 'attackWardFM', 'castWard', 'domeWard', 'weatherWard', 'mitigateIncoming',
  'ignoreStatePenalties', 'noBreath', 'noHunger', 'preventInfection', 'aideMedicale', 'reduceDiseaseDays', 'diseaseTestMod', 'suppressSymptom', 'skillDRBonus',
  'martyr', 'endPsych', 'removePsychTrait', 'suppressPsych', 'gainAdvantage', 'topUpAdvantage', 'critTwice',
  'grantCareerSkill', 'grantCareerTalent',
]);

export type SpellAffinity = 'ennemi' | 'allie' | 'tout';

/** Côté qu'un sort VISE, DÉRIVÉ de ses effets modélisés (aucun champ manuel sur les 243 sorts) :
 *  Projectile / Test opposé / Souffle / Poussée, ou un op « cible » NOCIF → 'ennemi' (ciblable sur
 *  l'ennemi, réticule + interdit hors portée comme le tir) ; un op « cible » BÉNÉFIQUE seul → 'allie' ; sinon
 *  (narratif, mixte, sans op de cible) → 'tout' (réticule permissif des deux côtés). La SOURCE est
 *  l'effet canon du sort (spells.json), pas une heuristique de mots-clés sur la description. */
export function spellAffinity(spell: NonNullable<ReturnType<typeof findSpellById>>): SpellAffinity {
  if (isMagicMissile(spell) || spell.opposed || spell.breathAttack) return 'ennemi';
  // Poussée/Attaques en chaîne portent leur effet positionnel en op `on:'caster'` (push/chain) — invisible
  // au scan 'target' mais OFFENSIF (repousse/rebondit sur l'ennemi) → ciblage ennemi. teleport reste neutre ('tout').
  if (spellOps(spell.effects, 'caster').some((o) => o.op === 'push' || o.op === 'chain')) return 'ennemi';
  const ops = spellOps(spell.effects, 'target').map((o) => o.op);
  if (ops.some((o) => HARMFUL_TARGET_OPS.has(o))) return 'ennemi';
  if (ops.some((o) => HELPFUL_TARGET_OPS.has(o))) return 'allie';
  return 'tout';
}

// ───────────────────────────────────────────────────────────────────────────
// Affordances (réticule au survol)
// ───────────────────────────────────────────────────────────────────────────

/**
 * BORDÉE — ce qui EMPÊCHE la volée sur cette cible, ou `null`. MESURE UNIQUE : le survol en tire son
 * `invalid` (rien ne s'affiche) et le commit (`ouvrirLaBordee`) en tire son refus DIT — sans elle, le
 * clic tirait hors de portée (aucun gate au commit) et l'arc ne se disait qu'au journal.
 */
export function batteryBlock(get: Get, ship: Combatant, target: Combatant): { reason: 'arc' | 'range'; detail: PlayerText } | null {
  const side = targetArc(get().facing[ship.id] ?? 'N', ship.pos!, target.pos!);
  const postes = bearingPostes(ship, side); // sur ce bord ET chargées (pas en cours de recharge, ch.12)
  if (!postes.length) return { reason: 'arc', detail: t('cs.bordeeNoArc', { ship: ship.label, side }) };
  // PORTÉE : les BANDES du socle (`rangeBandModifier`, rangées de `portee-d-une-arme`, LDB 62 l.198-206).
  // En deçà, le tir passe AVEC son modificateur de bande ; au-delà seulement, refus. Jamais
  // un seuil écrit ici : la pièce la plus longue du bord donne la Portée moyenne, le socle fait le reste.
  const mpt = sceneMetresPerTile(get().scene);
  const gbf = () => bonusDeForce(ship); // paresseux : la portée navale est fixe (number) → BF jamais évalué
  const maxRange = Math.max(...postes.map((p) => effectiveRange(p.item.range, gbf) ?? 0)); // mètres — la plus longue pièce du bord
  if (maxRange && rangeBandModifier(distanceDeCombat(ship, target), maxRange, mpt) == null)
    return { reason: 'range', detail: t('cs.refusBordeeHorsPortee', { ship: ship.label }) };
  return null;
}

/** Mode BORDÉE (navire) : le bord qui porte est dérivé de la cible (`targetArc`) ; réticule si une pièce
 *  du bord porte ET la cible est à portée (`batteryBlock`, même mesure qu'au commit). */
function batteryAffordance(get: Get, active: Combatant, target: Combatant): HoverTargeting {
  if (target.kind === active.kind || isOutOfAction(target)) return { kind: 'none' };
  const block = batteryBlock(get, active, target);
  if (block) return { kind: 'invalid', reason: block.reason };
  const side = targetArc(get().facing[active.id] ?? 'N', active.pos!, target.pos!);
  return { kind: 'ok', line: 'dashed', title: `Bordée ${side}`, skill: 'Tir de batterie', base: 0, mod: 0, dmg: null };
}

/** Mode incantation : mêmes gates que castSpell (équipe → portée → LdV). */
function castAffordance(get: Get, active: Combatant, target: Combatant): HoverTargeting {
  const battle = get().battle!;
  const sid = battle.selectedSpellId;
  if (!sid) return { kind: 'none' };
  const spell = findSpellById(sid);
  if (!spell) return { kind: 'none' };
  const missile = isMagicMissile(spell);
  // Côté ciblable dérivé de l'EFFET du sort (spellAffinity), plus du seul flag Projectile : un sort
  // offensif non-Projectile (Choc, Sommeil…) se cible désormais sur l'ennemi, comme le tir.
  const aff = spellAffinity(spell);
  const enemyOk = target.kind !== active.kind && !isOutOfAction(target);
  const allyOk = target.kind === active.kind && !target.dead && !target.outOfRencontre;
  if (!(aff === 'ennemi' ? enemyOk : aff === 'allie' ? allyOk : enemyOk || allyOk))
    return { kind: 'none' };
  // Portée puis Ligne de Vue : la MÊME mesure que le clic et que `castSpell` (`castTargetBlock`) — une
  // 2ᵉ écriture ferait diverger ce que le survol montre de ce que le geste fait.
  const horsAtteinte = castTargetBlock(get, active, spell, target);
  if (horsAtteinte) return { kind: 'invalid', reason: horsAtteinte.reason };
  const pv = previewCast(active, spell, {
    missile,
    focused: focalisationAboutie(active, spell),
    // L'affordance de survol vise une CIBLE désignée : elle annonce la cible réelle (protection de
    // la victime + Domaine/environnement), la même que la modale et que le jet.
    ctx: { s: get(), target },
  });
  const dmg = missile ? missileDamage(spell) : null;
  return {
    kind: 'ok',
    line: 'dashed',
    title: spell.label,
    skill: testSkillLabel(castInfo(spell)),
    base: pv.base,
    mod: pv.target - pv.base,
    // Dégâts d'un Projectile AVANT DR (evaluateMissile : sort + DR + BFM) — parité arme (Force incluse).
    dmg: dmg ? dmg.damage + bonus(effectiveChar(active, 'force-mentale')) : null,
  };
}

/**
 * Ce geste se résout-il par un Test d'ARME — donc par `previewAttack`, donc par une Difficulté de
 * combat composée (`LDB 14 l.91-96`) ?
 *
 * PRÉDICAT UNIQUE, consommé par le réticule (`attackAffordance`) ET par le badge de l'aperçu tap-1
 * (`previewDifficultyOf`) : sans lui, chacun tenait SA liste de `targeting`, et le badge nommait une
 * Difficulté d'arme là où le réticule se taisait — mesuré sur l'Empoignade (Test opposé de FORCE,
 * `LDB 14 l.161`) : réticule « Empoignade · Force » sans Difficulté, badge « Intermédiaire (+0) ».
 * Les gestes qui n'en sont PAS : servir une pièce (on rejoint une équipe),
 * zone (Souffle/Vomi/Langue/Regard), « Au contact » (Corps à corps opposé, `LDB 62 l.176`) et
 * Empoignade — tous des Tests dont la Difficulté ne se compose pas depuis une arme.
 */
export function gesteAuTestDArme(get: Get, active: Combatant, target: Combatant, option: AttackOption): boolean {
  const battle = get().battle;
  if (target.postes?.length && battle && serveTargetPoste(get().scene, active, target, battle.combatants)) return false;
  return option.targeting === 'melee';
}

/**
 * L'aperçu d'attaque DU GESTE — SOURCE UNIQUE des deux choses qu'un geste combiné change par rapport
 * à une frappe sur place : l'attaquant est à sa case d'ARRIVÉE (`dest`), et l'arme est celle que
 * l'option ARMÉE épingle (`option.weaponUid`), ou l'arme synthétisée de sa gratuite (`option.freeKind`,
 * même règle que `attackWeaponOf`), et l'Avantage qui lui RESTE une fois le coût du geste débité
 * (`avantageApresDepense`, le solde que `campSpend` pose au commit). Le réticule au survol et le badge de l'aperçu tap-1
 * passent tous deux par ici — sinon ils annoncent deux armes, donc deux Difficultés, pour un seul clic.
 */
export function apercuDuGeste(get: Get, active: Combatant, target: Combatant, option: AttackOption, dest?: Pt): AttackPreview {
  const weapon = (option.freeKind ? armeDeLaGratuite(active, option.freeKind, option.weaponUid) : null) ?? undefined;
  const attaquant = { ...active, ...(dest ? { pos: dest } : {}), advantage: avantageApresDepense(get, active, option.cost.advantage ?? 0) };
  return previewAttack(get, attaquant, target, undefined, { weaponUid: option.weaponUid, weapon });
}

/**
 * La Difficulté que dira le jet de l'aperçu tap-1 ARMÉ (`battle.preview`) — MÊME chemin que le
 * réticule (option armée, arme épinglée, case d'arrivée). `undefined` hors aperçu à cible.
 */
export function previewDifficultyOf(get: Get): DifficultyShown | undefined {
  const battle = get().battle;
  const pv = battle?.preview;
  if (!battle || !pv || !('targetId' in pv)) return undefined;
  const active = activeCombatant(battle);
  const target = inBattleId(battle, pv.targetId);
  if (!active || !target) return undefined;
  const option = selectedAttackOption(get().scene, active, battle);
  if (!option || !gesteAuTestDArme(get, active, target, option)) return undefined;
  return difficultyOf(apercuDuGeste(get, active, target, option, 'dest' in pv ? pv.dest : undefined));
}

/** Ce qui REFUSE l'attaque armée `option` de `active` sur `target` : le code que l'affordance rend en
 *  `invalid`, et le texte que le clic dit. */
export type RefusDAttaque = { reason: Extract<HoverTargeting, { kind: 'invalid' }>['reason']; texte: string };

/**
 * Verdict UNIQUE de l'attaque du mode ATTAQUE : `attackAffordance` le rend en `invalid`, `attackClickCommit`
 * le lit en tête. `plan` = celui de l'approche-puis-frappe (`attackPlan`), `null` pour une option qui ne
 * frappe pas (zone, Au contact, Empoignade). `approche` = la Charge armée par l'intention du clic (`chargeArmee`).
 * LDB 16 l.52 ; LDB 16 l.125 ; LDB 21 l.33 ; LDB 40 l.74 ; LDB 85 l.237 ; spec HUD § 2026-08-19.
 */
export function refusDAttaque(get: Get, active: Combatant, target: Combatant, option: AttackOption, plan: AttackPlan | null, { approche }: { approche: boolean }): RefusDAttaque | null {
  const battle = get().battle!;
  const horsDAgir = refusHorsDEtatDAgir(active) ?? refusVerrouDAction(active) ?? (option.cost.action ? refusPriereImposee(active) : null);
  if (horsDAgir) return { reason: 'hors-d-etat', texte: horsDAgir };
  const ft = isFrenzied(active) ? frenzyTarget(get, active) : null;
  if (ft && ft.id !== target.id) return { reason: 'frenesie-cible', texte: t('cs.frenzyMustAttack', { name: active.label, foe: ft.label }) };
  if (option.freeKind && !freeAttackTargetOk(get().scene, battle, active, option.freeKind, target)) {
    return { reason: 'cible-gratuite', texte: t('cs.refusCibleGratuite', { name: target.label, attaque: option.label }) };
  }
  if (!plan) return null;
  const depensee = option.cost.action && plan.kind !== 'attaque' ? refusActionDepensee(battle) : null;
  if (depensee) return { reason: 'action-depensee', texte: depensee };
  const gesteImpose = isFrenzied(active) || !option.cost.action;
  if (plan.kind !== 'attaque' && plan.kind !== 'bloque' && !approche && !gesteImpose) {
    return { reason: 'approche-non-armee', texte: t('cs.refusApprocheNonArmee', { name: target.label }) };
  }
  if (plan.kind === 'bloque') {
    const p = previewAttack(get, active, target, undefined, { weaponUid: option.weaponUid });
    return { reason: p.blocked ? 'los' : p.kind === 'melee' && isEngaged(active) ? 'engaged' : 'range', texte: plan.reason };
  }
  if (plan.kind === 'attaque' && !option.freeKind) {
    const block = firedAttackBlock(get, active, target, option.weaponUid);
    if (block) return { reason: block.reason, texte: block.detail };
  }
  return null;
}

/** Le plan d'approche-puis-frappe de l'option armée, `null` pour une option qui ne frappe pas. */
function planDuGeste(get: Get, active: Combatant, target: Combatant, option: AttackOption): AttackPlan | null {
  return gesteAuTestDArme(get, active, target, option)
    ? attackPlan(get, active, target, { reach: option.reach, forceMelee: option.forceMelee, weaponUid: option.weaponUid })
    : null;
}

function attackAffordance(get: Get, active: Combatant, target: Combatant): HoverTargeting {
  const battle = get().battle!;
  // Pièce de siège SERVABLE (poste, MDG 12 / AA 10 l.232) : un poste-porteur qu'on peut REJOINDRE (chef si non
  // servi, renfort sinon) → réticule « Servir » ; le clic rejoint l'équipe (jamais une attaque futile sur l'engin
  // inerte). Prioritaire. SOURCE `serveTargetPoste` (= hotbar/IA). Le tooltip d'ÉQUIPE (IsoStage) montre le détail.
  if (target.postes?.length) {
    const p = serveTargetPoste(get().scene, active, target, battle.combatants);
    if (!p) return { kind: 'none' };
    const join = isPosteManned(p, battle.combatants);
    return { kind: 'ok', line: 'solid', title: `${join ? 'Renfort' : 'Servir'} : ${p.item.label}`, skill: join ? "Renfort d'équipe" : 'Chef de pièce', base: 0, mod: 0, dmg: null };
  }
  const option = selectedAttackOption(get().scene, active, battle);
  if (!option) return { kind: 'none' }; // mode non-attaque (cast/heal/…) ou aucune attaque abordable
  if (target.kind === active.kind || isOutOfAction(target)) return { kind: 'none' };
  // Structure (mur/porte) : le réticule tombe (none) quand AUCUNE arme du porteur ne peut l'abîmer
  // (`structureImmune` — Impénétrable / Résistant, `ADE II 08 l.296-300` ; même filtre que l'IA, `ai.ts`) :
  // le survol retombe alors sur le déplacement (monter au rempart) au lieu d'un « hors de portée » absurde.
  // Une pièce de siège SERVIE la rend ciblable. Chemin JOUEUR : indépendant du drapeau `siege` de la
  // rencontre, qui ne gouverne que le vivier de l'IA. Une arme qui l'abîme reste ciblable : son Bonus
  // d'Endurance se compte une fois de plus par catégorie de Taille au-dessus du porteur (`AA 10 l.98`).
  if (isStructure(target) && active.weapons.every((w) => structureImmune(w, target))) return { kind: 'none' };
  // LE SURVOL N'AFFICHE QUE LE FAISABLE (contrat de ce fichier, arbitrage 2026-08-24) : le verdict du clic,
  // l'intention de Charge lue au client.
  const plan = planDuGeste(get, active, target, option);
  const refus = refusDAttaque(get, active, target, option, plan, { approche: chargeArmee(intentionLocale(get)) });
  if (refus) return { kind: 'invalid', reason: refus.reason };
  if (option.targeting === 'zone') // Souffle/Vomi/Langue/Regard/Étreinte : réticule simple (portée/LdV au résolveur moteur)
    return { kind: 'ok', line: 'dashed', title: option.label, skill: 'Capacité de Combat', base: 0, mod: 0, dmg: null };
  if (option.targeting === 'aucontact') // « Au Contact » (LDB 62 l.176) : Test opposé de Corps à corps, pas une frappe
    return auContactEligible(active, target)
      ? { kind: 'ok', line: 'dashed', title: 'Au contact', skill: 'Corps à corps', base: 0, mod: 0, dmg: null }
      : { kind: 'none' };
  if (option.targeting === 'grapple') // Empoignade (LDB 14 l.161) : Test opposé de Force, pas une frappe
    return grappleActionEligible(active, target)
      ? { kind: 'ok', line: 'dashed', title: 'Empoignade', skill: 'Force', base: 0, mod: 0, dmg: null }
      : { kind: 'none' };
  // === MÊLÉE (Arme + gratuites) : approche-puis-frappe — chemin réel + réticule au survol (le clic commet) ;
  // l'aperçu est calculé depuis la case d'ARRIVÉE. Seul geste dont la Difficulté se compose depuis une arme
  // (`gesteAuTestDArme`, le prédicat du badge de l'aperçu tap-1).
  if (!plan || plan.kind === 'bloque') return { kind: 'none' };
  // `option.weaponUid` ÉPINGLE l'arme du poste servi pour l'option DÉDIÉE « Servir » (jamais pour 'arme',
  // qui reste auto-choisie parmi les armes PERSONNELLES — `pickAttackWeaponList`/addendum « un intent, une entrée »).
  const p = apercuDuGeste(get, active, target, option, plan.kind === 'attaque' ? undefined : plan.dest);
  const palier = difficultyOf(p);
  return {
    kind: 'ok',
    // Gratuite (Morsure/Caudale/Tentacule) = toujours mêlée (trait solide) ; Arme = tir pointillé si à distance.
    line: option.freeKind ? 'solid' : p.kind === 'distance' ? 'dashed' : 'solid',
    title: p.weapon.label,
    skill: attackTestLabel(active, p.weapon, p.kind),
    base: p.base,
    // L'aperçu porte DÉJÀ sa cible plafonnée et écrêtée (`previewAttack` → `rollLine`) : le réticule
    // lit l'écart base→cible, il ne recombine rien (une 2ᵉ passe de `combineMods` amputerait la
    // ligne de plafond que l'aperçu vient de nommer).
    mod: p.target - p.base,
    // Difficulté du geste : celle que le SOCLE a composée pour CETTE cible (`previewAttack` →
    // `rollLine` → `composeDifficulty`), dans les termes de la modale — jamais recomposée ici.
    ...(palier ? { difficulty: palier } : {}),
    dmg: p.dmg, // (gratuite : Dégâts de l'arme tenue = cosmétique ; le chemin/réticule, lui, est exact)
    path: plan.kind === 'attaque' ? undefined : plan.path,
  };
}

/** Alliés soignables à portée de `active` (soi et son camp au contact). */
const soignablesAPortee = (get: Get<Jeu>, active: Combatant): Combatant[] => {
  const battle = get().battle;
  return battle ? healableTargets(campAuContact(get().scene, battle, active)) : [];
};

/** Mode SOIN (Guérison, LDB 09 ; Dextérité sous Bandages, LDB 74 l.41) : réticule « Soigner » sur soi + alliés
 *  adjacents qu'un soin de combat ouvert par `active` atteint (`modesDOuverture`) ; à portée sans soin de combat, la
 *  cible est refusée au clic. */
function healAffordance(get: Get, active: Combatant, target: Combatant): HoverTargeting {
  if (!soignablesAPortee(get, active).some((c) => c.id === target.id)) return { kind: 'none' };
  const mode = modesDOuverture(target, active)[0];
  if (!mode) return { kind: 'invalid', reason: 'sans-soin-de-combat' };
  const test = garanti(soinDOuverture(active, mode), mode, 'soin ouvert').test;
  return { kind: 'ok', line: 'solid', title: 'Soigner', skill: libelleDeTest(test), base: 0, mod: 0, dmg: null };
}

/** Sorts permanents dissipables PORTÉS par un combattant donné (regroupés par (sort, lanceur) —
 *  `dispellableSpellsOn` les rend déjà groupés, `carriers` dit qui en porte les effets). PUR :
 *  source unique du mode de ciblage ET du panneau-paramètre de la console. */
export function dispellableOnCarrier(get: Get<Jeu>, carrierId: string): DispellableSpell[] {
  const battle = get().battle;
  if (!battle) return [];
  return dispellableSpellsOn(battle.combatants).filter((d) => d.carriers.includes(carrierId));
}

/** Mode DISSIPATION (LDB 46 l.158-162) : la cible du clic est le PORTEUR du Sort, jamais un
 *  adversaire à frapper. Un non-porteur est INVALIDE (patron `approche-non-armee`) : le survol se
 *  tait, et le clic dit sa raison (`DISPEL_MODE.commitCombatant`). */
function dispelAffordance(get: Get, _active: Combatant, target: Combatant): HoverTargeting {
  if (dispellableOnCarrier(get, target.id).length === 0) return { kind: 'invalid', reason: 'sans-sort-dissipable' };
  return { kind: 'ok', line: 'dashed', title: 'Dissiper', skill: testSkillLabel(incantationArcane()), base: 0, mod: 0, dmg: null };
}

/** Mode SURINCANTATION (+Cible, LDB 47 l.28) : cibles supplémentaires éligibles (portée/éveillées/LdV). */
function overcastAffordance(get: Get, _active: Combatant, target: Combatant): HoverTargeting {
  const s = get();
  const pc = s.pendingCast!;
  const pool = s.battle?.combatants ?? s.party;
  const caster = pool.find((c) => c.id === pc.casterId);
  const spell = findSpellById(pc.spellId);
  if (!caster || !spell || !overcastTargetCandidates(pool, caster, pc.targetId, spell, !!pc.missile, overcastSourceOf(spell), pc.overcast?.range ?? 0, spellSightOf(get)).some((c) => c.id === target.id)) return { kind: 'none' };
  return { kind: 'ok', line: 'dashed', title: spell.label, skill: testSkillLabel(incantationArcane()), base: 0, mod: 0, dmg: null };
}

/** Mode FRAPPE MORTELLE (cleave, LDB 14 l.9) : enchaînements adjacents non encore frappés. */
function cleaveAffordance(get: Get, _active: Combatant, target: Combatant): HoverTargeting {
  const s = get();
  const battle = s.battle!;
  const pc = s.pendingCleave!;
  const atk = inBattleId(battle, pc.attackerId);
  if (!atk || !cleaveTargets(s.scene, battle, atk, pc.hitIds).some((c) => c.id === target.id)) return { kind: 'none' };
  const weapon = firedWeapon(s.scene, atk, target, undefined, battle.combatants); // MÊME résolution que la chaîne (resolveAttack, aucun weaponUid)
  // L'enchaînement est une VRAIE frappe : son réticule porte la valeur et la Difficulté du jet qu'il
  // ouvrira, comme le ciblage ordinaire (`attackAffordance`) — un interlude n'est pas un ciblage aveugle.
  const p = previewAttack(get, atk, target);
  return { kind: 'ok', line: 'solid', title: 'Frappe Mortelle', skill: attackTestLabel(atk, weapon, 'melee'), base: p.base, mod: p.target - p.base, dmg: p.dmg, ...(difficultyOf(p) ? { difficulty: difficultyOf(p)! } : {}) };
}

/** Mode 2ᵉ FRAPPE (deux armes, LDB 10 l.767-773) : cibles à portée de la main secondaire. */
function dualAffordance(get: Get, _active: Combatant, target: Combatant): HoverTargeting {
  const s = get();
  const battle = s.battle!;
  const ds = s.pendingDualStrike!;
  const atk = inBattleId(battle, ds.attackerId);
  const off = atk?.weapons.find((w) => w.uid === ds.offWeaponUid);
  if (!atk || !off || !dualStrikeTargets(s.scene, battle, atk, off).some((c) => c.id === target.id)) return { kind: 'none' };
  // 2ᵉ frappe = une frappe : le réticule porte la valeur et la Difficulté de SON jet — celui de la main
  // SECONDAIRE (`LDB 14 l.181`, pénalité comprise), pas celui de l'arme principale déjà résolue.
  const p = previewAttack(get, atk, target, undefined, { weaponUid: off.uid });
  return { kind: 'ok', line: 'solid', title: 'Deux armes', skill: attackTestLabel(atk, off, 'melee'), base: p.base, mod: p.target - p.base, dmg: p.dmg, ...(difficultyOf(p) ? { difficulty: difficultyOf(p)! } : {}) };
}

// ───────────────────────────────────────────────────────────────────────────
// Commit COMBATTANT (clic-token)
// ───────────────────────────────────────────────────────────────────────────

/** ATTAQUE : approche-puis-frappe — le SEUL exécuteur charge/moveAttack du jeu ; `active`/`id`/`opts`
 *  fournis par l'aiguilleur (`cliquerLeCombattant`). Lit `refusDAttaque` en tête. */
function attackClickCommit(get: Get, set: Set, active: Combatant, id: string, opts?: BattleClickOpts): void {
  const battle = get().battle;
  const scene = get().scene;
  if (!battle) return;
  const target = inBattleId(battle, id);
  if (!target) return;
  // Pièce de siège : un clic REJOINT l'équipe (chef/renfort) au lieu d'attaquer l'engin inerte — MÊME chemin que le
  // bouton hotbar (`servirLePoste`) et l'IA (`serveAtPoste`). `serveTargetPoste` = source unique de la cible.
  if (target.postes?.length) {
    const p = serveTargetPoste(get().scene, active, target, battle.combatants);
    if (p) { get().servirLePoste(p.item.uid); return; }
  }
  // ATTAQUE unifiée : l'`AttackOption` armée (`selectedAttack`, défaut 'arme' ; les modes
  // maneuver/tentacle mappent sur leur option).
  const option = selectedAttackOption(get().scene, active, battle);
  if (!option || !scene) return;
  if (target.kind === active.kind) return; // camp RELATIF : on ne frappe que le camp ADVERSE (soin/sort via leurs modes)
  const plan = planDuGeste(get, active, target, option);
  const refus = refusDAttaque(get, active, target, option, plan, { approche: chargeArmee(opts?.intentionId ?? null) });
  if (refus) {
    refuserGesteDuSiege(get, set, refus.texte);
    if (battle.preview) set({ battle: { ...get().battle!, preview: null } });
    bus.emit(EVT.SCENE_DIRTY);
    return;
  }
  // « Au Contact » (LDB 62 l.176) : action de Test opposé (pas une frappe) → flux dédié, jamais l'approche-puis-frappe.
  if (option.targeting === 'aucontact') return get().ouvrirLAuContact(target.id);
  // Empoignade (LDB 14 l.161) : action de Test opposé de Force entre deux Empoignés → flux dédié.
  if (option.targeting === 'grapple') return get().ouvrirLEmpoignade(target.id);
  if (option.targeting === 'zone') {
    set({ pendingManeuver: { attackerId: active.id, kind: option.kind!, attaque: option.id, targetId: target.id, avantageSpent: option.modeDAvantage === 'variable' ? 1 : option.cost.advantage, result: null }, battle: { ...battle, action: null, selectedAttack: undefined } });
    return;
  }
  // === MÊLÉE : approche-puis-frappe (le SEUL exécuteur charge/moveAttack du jeu) ===
  if (!plan || plan.kind === 'bloque') return;
  // Tap 1 : APERÇU — sauf confirmation (tests), ré-entrée du choix cavalier/monture,
  // ou re-tap de la même cible avec le même plan.
  const prev = battle.preview;
  const samePreview = !!prev && 'targetId' in prev && prev.targetId === id && prev.kind === plan.kind;
  if (!opts?.confirm && !opts?.skipMountChoice && !samePreview) {
    set({ battle: { ...battle, preview: plan.kind === 'attaque' ? { kind: 'attaque', targetId: id } : { ...plan, targetId: id } } });
    bus.emit(EVT.SCENE_DIRTY);
    return;
  }
  // Tap 2 : COMMIT. Choix cavalier/monture (LDB 14 l.181) AVANT toute résolution — on n'ouvre la
  // modale qu'une fois (skipMountChoice évite la ré-entrée après le choix).
  if (!opts?.skipMountChoice) {
    const rider = target.mountId ? target : inBattleId(battle, target.riderId);
    const mount = target.riderId ? target : inBattleId(battle, target.mountId);
    if (rider && mount && rider.kind !== 'heros' && mount.kind !== 'heros' && !isOutOfAction(rider) && !isOutOfAction(mount)) {
      set({ pendingMountTarget: { riderId: rider.id, mountId: mount.id, intentionId: opts?.intentionId } });
      return;
    }
  }
  // Peur (LDB 21 l.27) : charger / rejoindre une source de Peur = s'en RAPPROCHER (`retenuParLaPeur`).
  if ((plan.kind === 'charge' || plan.kind === 'deplacementEtAttaque') && retenuParLaPeur(get, set, active, plan.dest, { kind: 'entity', id, intentionId: opts?.intentionId })) return;
  if (battle.preview) set({ battle: { ...get().battle!, preview: null } });
  // Bénédiction de Protection (LDB 41 l.142) : la cible bénie impose un Test de FM Accessible (+20)
  // AVANT d'engager quoi que ce soit (charge comprise). Le jet du HÉROS est INFLUENÇABLE (Chance/
  // Résilience) → il DIFFÈRE la déclaration derrière `pendingWard`. `wardCleared` = ce gate a déjà été
  // franchi pour CE clic (relance) → on le saute.
  if (!opts?.wardCleared && hasActiveFlag(target, 'attackWardFM')) {
    set({ pendingWard: { attackerId: active.id, targetId: target.id, intentionId: opts?.intentionId, result: null }, battle: { ...get().battle!, preview: null } });
    bus.emit(EVT.SCENE_DIRTY);
    return;
  }
  // Avantage de la manœuvre dépensé UNE fois, à la frappe (après TOUS les portails — aperçu/monture/Peur/
  // ward) : gratuites de mêlée (Morsure/Caudale… coût RAW). L'Arme (cost.advantage 0) ne dépense rien.
  const mouvementAvant = get().battle!.movementUsed ?? 0;
  const avantageAvant = active.advantage;
  if (option.cost.advantage) campSpend(get, active, option.cost.advantage); // réserve du camp en mode groupe (AA 11 l.30-38) / le combattant (LDB)
  if (option.cost.movement) set({ battle: { ...get().battle!, movementUsed: mountMovement(get().battle!, active) } }); // LDB 85 l.314
  const mouvementPaye = (get().battle!.movementUsed ?? 0) - mouvementAvant;
  const avantagePaye = avantageAvant - active.advantage;
  const coutPaye = avantagePaye || mouvementPaye ? { advantage: avantagePaye, movement: mouvementPaye } : undefined;
  // === Approche-puis-frappe : DEUX beats explicites ===
  let approachPath: { x: number; y: number }[] | null = null;
  let pa: Jeu['pendingAttack'];
  if (plan.kind === 'charge') {
    // Charge (LDB 15 l.35-37) : se ruer au contact (portée de Course) puis attaquer — manœuvre
    // PLEINE (consomme tout le Mouvement). Combat monté : empreinte/Course de la MONTURE.
    // Undo PRÉ-JET (retour playtest) : capture l'état d'AVANT la charge pour pouvoir Annuler un misclic
    // tant qu'aucun dé n'est lancé et que la cible n'a pas répondu (`jetAnnuler('attaque')`) — positions, orientation,
    // Mouvement, Avantage, chargé.
    const chargeUndo = {
      pos: Object.fromEntries(battle.combatants.filter((c) => c.pos).map((c) => [c.id, { ...c.pos! }])),
      facing: { ...get().facing }, movedPreAction: battle.movedPreAction, movementUsed: battle.movementUsed ?? 0,
      advGained: plan.adv, gainedAdvBefore: active.gainedAdvThisRound ?? false, chargedBefore: active.chargedThisTurn ?? false, avecAvantageBefore: active.chargeAvecAvantage ?? false,
    };
    const geom = mountOf(battle, active) ?? active;
    approachPath = plan.path;
    const chargeFrom = { ...active.pos! };
    placeCombatant(active, get().scene, plan.dest);
    if (geom !== active) placeCombatant(geom, get().scene, plan.dest); // la monture charge sous le cavalier
    displaceSmaller(get, geom); // charge d'un grand : idem dégage les plus petits (85 l.373-374)
    get().orienterSelonLeChemin(active.id, approachPath);
    if (geom !== active) get().orienterSelonLeChemin(geom.id, approachPath);
    bus.emit(EVT.ANIM_MOVE, { id: active.id, path: approachPath });
    if (geom !== active) bus.emit(EVT.ANIM_MOVE, { id: geom.id, path: approachPath });
    applyZoneCrossings(get, set, active, approachPath); // Mur de feu & co (L11) : charger À TRAVERS coûte
    noteApproachMove(active, chargeFrom); // LDB 21 l.27 — événement EN ATTENTE : purgé si la charge est annulée avant le jet
    set({ battle: { ...get().battle!, movementUsed: mountMovement(battle, active), action: null, preview: null } });
    const repondu = declarerLaCharge(get, set, active, target, plan.adv); // LDB 10 l.500
    pa = { attackerId: active.id, targetId: target.id, location: null, result: null, fromCharge: true, ...(repondu ? {} : { chargeUndo }), ...(option.freeKind ? { freeKind: option.freeKind } : {}), ...(option.weaponUid ? { weaponUid: option.weaponUid } : {}) };
  } else {
    if (plan.kind === 'deplacementEtAttaque') {
      // Rejoindre la cible dans la Marche restante (pas une Charge → pas de bonus), puis attaquer.
      // MÊMES mutations qu'un segment de cliquerLaCaseDuCombat (snapshot d'annulation compris).
      const b = get().battle!;
      const snapshot = (b.movementUsed ?? 0) === 0 ? captureMoveSnapshot(b, get().facing) : b.moveSnapshot ?? null;
      const geom = mountOf(b, active) ?? active;
      approachPath = plan.path;
      const moveFrom = { ...active.pos! };
      placeCombatant(active, get().scene, plan.dest);
      if (geom !== active) placeCombatant(geom, get().scene, plan.dest);
      displaceSmaller(get, geom);
      get().orienterSelonLeChemin(active.id, approachPath);
      if (geom !== active) get().orienterSelonLeChemin(geom.id, approachPath);
      bus.emit(EVT.ANIM_MOVE, { id: active.id, path: approachPath });
      if (geom !== active) bus.emit(EVT.ANIM_MOVE, { id: geom.id, path: approachPath });
      applyZoneCrossings(get, set, active, approachPath); // Mur de feu & co (L11)
      noteApproachMove(active, moveFrom); // LDB 21 l.27 — événement EN ATTENTE, scellé par l'attaque qui suit
      set({ battle: { ...b, moveSnapshot: snapshot, movementUsed: (b.movementUsed ?? 0) + plan.cost, movedPreAction: b.movedPreAction || !b.acted, action: null, reachable: new Map(), preview: null } });
      bus.emit(EVT.SCENE_DIRTY);
    }
    if (option.freeKind) {
      // Frappe GRATUITE (Morsure/Caudale/Tentacule) — déjà à portée (Allonge 1) : résolveur = arme
      // naturelle synthétique (freeAttackWeapon, via `pa.freeKind`) ; pas de gate Allonge/munitions.
      pa = { attackerId: active.id, targetId: target.id, location: null, result: null, freeKind: option.freeKind, ...(option.weaponUid ? { weaponUid: option.weaponUid } : {}) };
    } else {
      // Arme effectivement employée : choix EXPLICITE (poste servi → `option.weaponUid` épingle le canon)
      // sinon auto — chaque candidate de mêlée évaluée avec SA PROPRE géométrie (`pickAttackWeapon`,
      // #BUG-A : une arme personnelle n'hérite jamais de l'allonge de la coque servie) — PAS weapons[0],
      // sinon un héros mixte mêlée+distance ne pourrait jamais tirer une cible éloignée (LDB Armes l.297-298).
      const battleNow = get().battle!;
      const w = pickAttackWeapon(get().scene, battleNow, active, target, option.weaponUid);
      if (w.type === 'melee' && distanceDeContact(get().scene, attackGeomOf(battleNow, active, w), combatGeomOf(battleNow, target)) > reachTiles(w)) {
        refuserGesteDuSiege(get, set, t('cs.meleeOutOfRange')); // aucune arme à distance dispo → mêlée hors de portée
        return;
      }
      pa = { attackerId: active.id, targetId: target.id, location: null, result: null, ...(option.weaponUid ? { weaponUid: option.weaponUid } : {}) };
    }
  }
  // Cible Inconsciente (LDB 16 l.113) : l'attaquant gagne « Je ne faillirai pas ! » SANS dépenser de
  // Résilience → réutilise le MÊME picker de Localisation (`pa.forcee`/CritLocationPicker, LDB 17 l.68)
  // que le Critique forcé par Résilience. Réservé au joueur qui PILOTE ; l'IA (doAttack) résout hors de
  // ce chemin (pendingAttack), donc ne voit jamais ce choix.
  if (isHelplessTarget(target) && pilotedByHuman(get(), active)) pa = { ...pa, forcee: true };
  if (coutPaye) pa = { ...pa, coutPaye };
  if (active.chargedThisTurn) pa = { ...pa, fromCharge: true }; // LDB 15 l.35
  // (2) FRAPPE — après le glissé d'approche (sur-le-champ au contact) : la suite du tour du joueur, armée par l'armeur
  // unique (`armerLaSuite`), ouvre la SÉQUENCE de combat (jet d'attaque = ÉTAPE 0).
  armerLaSuite(get, set, active, { kind: 'frappePilotee', pa }, approachMs(get, approachPath));
}

/** CAST : un token n'est pas une cible de ZONE (la zone se pose après le jet) → modale ; sinon
 *  l'incantation vise l'allié/ennemi/soi. */
function castClickCommit(get: Get, set: Set, active: Combatant, id: string): void {
  const battle = get().battle;
  if (!battle || !battle.selectedSpellId) return;
  const target = inBattleId(battle, id);
  if (!target) return;
  // Cible hors d'atteinte (portée/LdV) : refus DIT au point du geste, et RIEN ne s'ouvre — AVANT le
  // routage de ZONE, sinon un sort de zone ouvrait sa cascade sans un mot sur une cible que
  // l'affordance déclarait déjà hors d'atteinte. MÊME mesure que le survol et que `castSpell`.
  const spell = findSpellById(battle.selectedSpellId);
  const horsAtteinte = spell ? castTargetBlock(get, active, spell, target) : null;
  if (horsAtteinte) return void refuserGeste(get, set, horsAtteinte.detail);
  // Sort de ZONE : un token n'est pas une cible (la zone se pose après le jet) → modale.
  if (castZoneSpell(get, set, active, battle.selectedSpellId)) return;
  // L'incantation peut viser un allié, un ennemi ou soi-même.
  castSpell(get, set, active, target, battle.selectedSpellId);
}

// ───────────────────────────────────────────────────────────────────────────
// Commit CASE (clic-sol)
// ───────────────────────────────────────────────────────────────────────────

/** TÉLÉPORTATION (Jalon 2.6 — sort « Téléportation », LDB 47) : le lanceur choisit sa case d'arrivée
 *  parmi les cases en surbrillance (survol des obstacles). */
function teleportCommitTile(get: Get, set: Set, active: Combatant, pt: Pt): void {
  const battle = get().battle;
  if (!battle) return;
  const k = tileKey(pt.x, pt.y, pt.z);
  if (!battle.reachable.has(k)) return;
  const from = { ...active.pos! };
  const mount = mountOf(battle, active);
  placeCombatant(active, get().scene, pt);
  if (mount) placeCombatant(mount, get().scene, pt); // couple cavalier↔monture solidaire (comme le déplacement)
  displaceSmaller(get, mount ?? active); // un grand qui se téléporte dégage aussi les plus petits sous son empreinte (LDB 85 l.373-374)
  get().orienterSelonLeChemin(active.id, [from, pt]);
  bus.emit(EVT.ANIM_MOVE, { id: active.id, path: [{ ...pt }] });
  if (mount) bus.emit(EVT.ANIM_MOVE, { id: mount.id, path: [{ ...pt }] });
  set({ battle: { ...battle, action: null, reachable: new Map(), preview: null, log: [...battle.log, ev('deplacement', t('cs.teleport', { name: active.label }), active.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
}

/** POUSSÉE d'un engin de siège CREWÉ (ADE II 8 l.258, Lot 2 #156) : le CHEF choisit sa case
 *  d'arrivée parmi les cases en surbrillance (`battle.reachable`, posé par `pousserLEngin` — plafonné
 *  à `rule('engin-de-siege-vitesse-de-poussee')`) — mouvement SIMPLE, aucun jet. Le delta (case cliquée − position
 *  du chef) est appliqué à l'ENGIN et à TOUS les servants du poste (`ShipPoste.crewIds`, chef inclus) :
 *  formation RIGIDE (`translaterFormation`). Consomme l'Action du chef (comme `servirLePoste`) ; l'engin reste SANS tour (`inert`,
 *  jamais ajouté à `battle.order`) — seul le rendu de la pièce suit (`posteAnchor` lit `hull.pos`).
 *  La case du CHEF passe `battle.reachable` ; la formation entière se refuse (`refuserGeste`) quand
 *  `translaterFormation` juge une case d'arrivée invalide. */
function pushCommitTile(get: Get, set: Set, active: Combatant, pt: Pt): void {
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene || !active.pos) return;
  const k = tileKey(pt.x, pt.y, pt.z);
  if (!battle.reachable.has(k)) return;
  const poste = active.mannedPoste;
  const hull = poste && posteDeLaBataille(poste.item.uid, battle.combatants)?.porteur;
  if (!poste || !hull?.pos) return;
  // Annulation (#199) : au PREMIER segment du Tour (`movementUsed === 0`), capture l'état AVANT de
  // pousser — MÊME snapshot que cliquerLaCaseDuCombat/moveAttack (positions + facing + movedPreAction +
  // loseNextMovement des servants), pour que `annulerLeDeplacement` défasse aussi une poussée.
  const snapshot = (battle.movementUsed ?? 0) === 0 ? captureMoveSnapshot(battle, get().facing) : battle.moveSnapshot ?? null;
  const delta = { x: pt.x - active.pos.x, y: pt.y - active.pos.y };
  const deplaces = translaterFormation(battle.combatants, scene, hull, poste.crewIds ?? [], delta);
  if (!deplaces) { refuserGeste(get, set, t('cs.refusFormationBloquee')); return; }
  for (const { mobile, depart } of deplaces) bus.emit(EVT.ANIM_MOVE, { id: mobile.id, path: [depart, { ...mobile.pos! }] });
  const dist = chebyshev(delta, { x: 0, y: 0 });
  // Pousser = le MOUVEMENT de TOUT l'équipage (LDB 13 l.106 : locomotion, aucun Test → le Mouvement, pas
  // l'Action). Le chef dépense son Mouvement MAINTENANT ; chaque autre servant dépensera le sien à son tour
  // (`loseNextMovement`) — tous poussent, tous en paient le Mouvement. L'Action du chef reste libre (il peut
  // assener la porte le même Round une fois au contact).
  for (const id of poste.crewIds ?? []) {
    if (id === active.id) continue;
    const c = inBattleId(battle, id);
    if (c) c.loseNextMovement = true;
  }
  const log = [...battle.log, ev('deplacement', t('cs.pushEngine', { name: active.label, weapon: hull.label, n: dist, s: dist > 1 ? 's' : '' }), active.id)];
  set({ battle: { ...get().battle!, moveSnapshot: snapshot, movementUsed: mountMovement(get().battle!, active), action: null, reachable: new Map(), preview: null, log } });
  bus.emit(EVT.SCENE_DIRTY);
}

/** Sort de ZONE sélectionné : le clic-case OUVRE la modale — le centre se choisit APRÈS le jet.
 *  Sort non-zone : clic-sol sans effet en mode cast. */
function castCommitTile(get: Get, set: Set, active: Combatant, _pt: Pt): void {
  const battle = get().battle;
  if (battle && battle.action === 'incantation' && battle.selectedSpellId && !battle.acted && !get().pendingCast) {
    castZoneSpell(get, set, active, battle.selectedSpellId);
  }
}

/** Pose la zone en cours sur la case d'un combattant cliqué (cast-zone / siège). */
function placingCommitCombatant(get: Get, _set: Set, _active: Combatant, id: string): void {
  const t = inBattleId(get().battle, id);
  if (t?.pos) get().cliquerLaCaseDuCombat({ ...t.pos });
}

// ───────────────────────────────────────────────────────────────────────────
// Les MODES (objets statiques) + l'aiguilleur
// ───────────────────────────────────────────────────────────────────────────

/** Mode ATTAQUE (mode neutre) — exporté pour son IDENTITÉ, comme `CAST_MODE` : les anneaux de cibles du
 *  mode neutre se peignent quand c'est LUI qui tient le ciblage (`gameIso/stage/highlightLayer`). */
export const ATTACK_MODE = { id: 'attaque', affordance: attackAffordance, commitCombatant: attackClickCommit } satisfies TargetingMode;
/** Mode INCANTATION — exporté parce que son IDENTITÉ est ce que `battle.action` porte quand le geste
 *  est armé : tout consommateur qui demande « le mode incantation est-il armé ? » compare à CE mode
 *  (`CAST_MODE.id`). L'entrée du registre d'actions qui l'arme (`armed`) est libre de son propre id. */
export const CAST_MODE = {
  id: 'incantation', affordance: castAffordance, commitCombatant: castClickCommit, commitTile: castCommitTile,
} satisfies TargetingMode;
const BATTERY_MODE = {
  id: 'bordee', label: 'Bordée', consigne: 'consigne.bordee', affordance: batteryAffordance,
  commitCombatant: (get, _set, active, id) => { get().ouvrirLaBordee(active.id, id); },
} satisfies TargetingMode;
const HEAL_MODE = {
  id: 'soins', affordance: healAffordance, anneauCandidats: 'ami',
  candidates: (get, active) => soignablesAPortee(get, active).filter((c) => modesDOuverture(c, active).length > 0),
  // L'acte d'ouverture et son refus vivent dans `ouvrirLaGuerison` ; la modale bascule l'acte (`jetRegler('soins', 'mode')`).
  commitCombatant: (get, _set, _active, id) => get().ouvrirLaGuerison(id),
} satisfies TargetingMode;
/** ≥2 Sorts dissipables sur ce porteur : il reste un PARAMÈTRE à demander (le panneau borné de la
 *  console). Prédicat PARTAGÉ par l'élection locale et par le commit — une seule mesure. */
const dispelParametreADemander = (get: Get, id: string): boolean => dispellableOnCarrier(get, id).length > 1;

/**
 * Mode DISSIPATION (LDB 46 l.158-162) — armé par la case Dissiper (`battle.action === 'dissipation'`).
 * Le clic-token SÉLECTIONNE le porteur, il n'attaque JAMAIS : c'est le PORTEUR qui est la cible du
 * geste, et le SORT à dissiper qui reste à choisir (paramètre borné, spec HUD §1d). Un seul Sort sur
 * le porteur = commit direct (un panneau à un choix serait du bruit) ; N Sorts = le panneau-paramètre
 * de la console naît de l'alvéole, sur `dispelCarrierId`.
 *
 * COOP : cette élection est un choix d'ÉCRAN, elle se joue chez l'ÉMETTEUR (`electionLocale`) — le
 * porteur élu vit hors instantané (`coop.instantaneDeLaCoop`), et seul le COMMIT `dissiperLeSort`
 * voyage. Sans cette déclaration, l'intent d'un invité faisait naître le panneau chez L'HÔTE.
 */
const DISPEL_MODE = {
  id: 'dissipation', affordance: dispelAffordance,
  candidates: (get) => (get().battle?.combatants ?? []).filter((c) => dispellableOnCarrier(get, c.id).length > 0),
  electionLocale: dispelParametreADemander,
  commitCombatant: (get, set, active, id) => {
    const porte = dispellableOnCarrier(get, id);
    if (porte.length === 0) return void refuserGeste(get, set, t('cs.refusSansSortDissipable'));
    if (dispelParametreADemander(get, id)) { get().designerLeSupport(id); return; }
    get().dissiperLeSort(active.id, porte[0].spellId, porte[0].casterId);
  },
} satisfies TargetingMode;
const OVERCAST_MODE = {
  id: 'surincantation', label: 'Surincantation', consigne: 'consigne.surincantation', affordance: overcastAffordance, anneauCandidats: 'hostile',
  candidates: (get) => {
    const s = get();
    const pc = s.pendingCast;
    const pool = s.battle?.combatants ?? s.party;
    const caster = pc && pool.find((c) => c.id === pc.casterId);
    const spell = pc && findSpellById(pc.spellId);
    if (!pc || !caster || !spell) return [];
    return overcastTargetCandidates(pool, caster, pc.targetId, spell, !!pc.missile, overcastSourceOf(spell), pc.overcast?.range ?? 0, spellSightOf(get));
  },
  commitCombatant: (get, _set, _active, id) => { get().jetRegler('incantation', 'ciblesSupplementaires', ciblesBasculees(get().pendingCast?.extraTargetIds, id)); },
} satisfies TargetingMode;
const CLEAVE_MODE = {
  id: 'frappeMortelle', label: 'Frappe Mortelle', consigne: 'consigne.frappeMortelle', affordance: cleaveAffordance, anneauCandidats: 'hostile',
  candidates: (get) => {
    const s = get();
    const battle = s.battle;
    const pc = s.pendingCleave;
    const atk = battle && pc && inBattleId(battle, pc.attackerId);
    return battle && pc && atk ? cleaveTargets(s.scene, battle, atk, pc.hitIds) : [];
  },
  commitCombatant: (get, _set, _active, id) => { get().frapperEnBalayage(id); },
} satisfies TargetingMode;
const DUAL_MODE = {
  id: 'deuxArmes', label: 'Des deux armes', consigne: 'consigne.deuxArmes', affordance: dualAffordance, anneauCandidats: 'hostile',
  candidates: (get) => {
    const s = get();
    const battle = s.battle;
    const ds = s.pendingDualStrike;
    const atk = battle && ds && inBattleId(battle, ds.attackerId);
    const off = atk && ds && atk.weapons.find((w) => w.uid === ds.offWeaponUid);
    return battle && atk && off ? dualStrikeTargets(s.scene, battle, atk, off) : [];
  },
  commitCombatant: (get, _set, _active, id) => { get().frapperDeLaSecondeArme(id); },
} satisfies TargetingMode;
const TELEPORT_MODE = {
  id: 'teleportation', label: 'Téléportation', consigne: 'consigne.teleportation',
  tileValidAt: (get, _active, pt) => !!get().battle?.reachable.has(tileKey(pt.x, pt.y, pt.z)),
  commitTile: teleportCommitTile,
  tilePreview: (_get, active, pt) => (active.pos ? { target: pt, path: [active.pos, pt], label: 'Téléporter' } : null),
} satisfies TileTargetingMode;
/** POUSSÉE d'un engin de siège (ADE II 8 l.258, Lot 2 #156) : case-cible parmi `battle.reachable`
 *  (posé par `pousserLEngin`), MÊME gabarit que TELEPORT_MODE. */
const PUSH_MODE = {
  id: 'poussee',
  tileValidAt: (get, _active, pt) => !!get().battle?.reachable.has(tileKey(pt.x, pt.y, pt.z)),
  commitTile: pushCommitTile,
  tilePreview: (get, active, pt) => {
    if (!active.pos) return null;
    const cost = get().battle?.reachable.get(tileKey(pt.x, pt.y, pt.z)) ?? 0;
    return { target: pt, path: [active.pos, pt], cost, label: `Pousser (${cost})` };
  },
} satisfies TileTargetingMode;
/** Pose libre d'un gabarit de zone (sort de ZdE après jet OU pilonnage indirect de siège). */
const PLACING_MODE = {
  id: 'poseDeLaZone', label: 'Pose de la zone', consigne: 'consigne.poseDeLaZone',
  tileValidAt: (get, _active, pt) => { const pz = placingZoneOf(get()); return !!pz && placedZoneValidAt(get, pz, pt); },
  commitTile: (get, set, _active, pt) => commitPlacedZone(get, set, pt),
  commitCombatant: placingCommitCombatant,
  tilePreview: (_get, _active, pt) => ({ target: pt, label: 'Poser la zone' }),
} satisfies TileTargetingMode;

/** Catalogue des modes-CASE (#198) — SOURCE UNIQUE pour la garde exhaustive (test qui les itère et
 *  vérifie un aperçu non-vide sur une tuile valide) et pour tout consommateur générique (aperçu au
 *  survol, adressabilité DOM des cases valides). */
export const TILE_MODES: readonly TileTargetingMode[] = [TELEPORT_MODE, PUSH_MODE, PLACING_MODE];

/** Chaque mode, par son id (`MODES_DE_CIBLAGE`) : un id sans mode, ou un mode rangé sous un autre id, ne compile pas.
 *  L'aiguilleur ci-dessous garde SA priorité : cette table ne décide de rien. */
const MODE_PAR_ID: { readonly [M in IdDeModeDeCiblage]: TargetingMode & { readonly id: M } } = {
  attaque: ATTACK_MODE, incantation: CAST_MODE, bordee: BATTERY_MODE, soins: HEAL_MODE, dissipation: DISPEL_MODE,
  surincantation: OVERCAST_MODE, frappeMortelle: CLEAVE_MODE, deuxArmes: DUAL_MODE, teleportation: TELEPORT_MODE,
  poussee: PUSH_MODE, poseDeLaZone: PLACING_MODE,
};

/** Catalogue de TOUS les modes, énumérables à l'exécution (libellé de phase d'un interlude). */
export const TARGETING_MODES: readonly TargetingMode[] = Object.values(MODE_PAR_ID);

/** Nom d'affichage de la phase de ciblage d'un mode (`undefined` = mode sans bandeau). */
export const targetingModeLabel = (modeId: IdDeModeDeCiblage): string | undefined => MODE_PAR_ID[modeId].label;

/** Consigne d'affichage de la phase de ciblage d'un mode (`undefined` = mode sans consigne). */
export const targetingModeConsigne = (modeId: IdDeModeDeCiblage): PlayerText | undefined => {
  const cle = MODE_PAR_ID[modeId].consigne;
  return cle ? t(cle) : undefined;
};

/**
 * Ennemis GRISÉS hors Ligne de Vue du héros actif (LDB 13 l.114 ; sort : LDB 46 l.121), la source unique
 * du grisage que lit le survol (`gameIso/stage/useHoverTargeting.ts`). Le mode incantation armé se lit au
 * REGISTRE (`CAST_MODE.id`), jamais à un id d'action recopié. Vide hors combat, combat fini, ou une fois
 * l'Action engagée (`acted`) ou un autre geste armé (`action`).
 */
export function ciblesHorsDeVue(get: Get): globalThis.Set<string> {
  const { mode, battle } = get();
  if (mode !== 'battle' || !battle || battle.over) return new Set<string>();
  if (battle.action === CAST_MODE.id && battle.selectedSpellId) return castOutOfSightTargetIds(get);
  if (battle.acted || battle.action !== null) return new Set<string>();
  return outOfSightTargetIds(get);
}

/**
 * Aiguilleur UNIQUE — extrait factuellement des priorités de `cliquerLeCombattant`/`hoverAim` :
 *   pendingCleave > pendingDualStrike > pendingCast.pickingTargets (Surincantation) >
 *   zoneEnPose (cast-zone OU siège) > battle.action ∈ {cast, heal, dispel, battery, teleport} > attack.
 * `battle.action` (string) et les `pending*` RESTENT l'état sous-jacent (ils gatent aussi mouvement/
 * fin de tour ailleurs) — on n'en DÉRIVE que le mode de ciblage.
 * La TÊTE de cette priorité (les fenêtres qui DÉTIENNENT le ciblage) est la projection de
 * `detenteurDuCiblage` (#1016), que la possession du clic chez l'invité (`targetingHolder`) projette
 * aussi : un genre de détenteur sans mode casse la compilation ici.
 */
export function currentTargetingMode(get: Get<Jeu>): TargetingMode {
  const s = get();
  const d = detenteurDuCiblage(s);
  switch (d?.genre) {
    case 'pendingCleave': return CLEAVE_MODE;
    case 'pendingDualStrike': return DUAL_MODE;
    case 'surincantation': return OVERCAST_MODE;
    case 'zone': return PLACING_MODE;
    case undefined: break;
    default: return d satisfies never;
  }
  const action = s.battle?.action ?? null;
  if (action === 'incantation') return CAST_MODE;
  if (action === 'soins') return HEAL_MODE;
  if (action === 'dissipation') return DISPEL_MODE;
  if (action === 'bordee') return BATTERY_MODE;
  if (action === 'teleportation') return TELEPORT_MODE;
  if (action === 'poussee') return PUSH_MODE;
  return ATTACK_MODE;
}

/**
 * Un ciblage d'ENTITÉ est-il ARMÉ ? DÉRIVÉ du registre — jamais une liste d'ids recopiée : le mode
 * courant est un mode-COMBATTANT (il définit `commitCombatant`, donc son clic-token commet un geste
 * sur une entité) et ce n'est pas `ATTACK_MODE`, que l'aiguilleur rend AUSSI quand rien n'est armé —
 * il ne peut donc témoigner d'aucun armement. Les modes-CASE (téléportation, poussée) n'ont pas de
 * `commitCombatant` : ils en sortent d'eux-mêmes.
 * Consommé par les surfaces PORTRAIT (dock du groupe), pour router le clic vers `cliquerLaCase`
 * comme le clic-jeton au lieu d'ouvrir la fiche.
 */
export function ciblageEntiteArme(get: Get): boolean {
  const battle = get().battle;
  if (!battle || battle.over) return false;
  const mode = currentTargetingMode(get);
  return mode !== ATTACK_MODE && !!mode.commitCombatant;
}

/**
 * GESTES CONSOMMÉS CHEZ L'ÉMETTEUR (coop) — jumelle de `INTENTION_JOINTE_AUX_ARGS` (`localIntent.ts`) :
 * une action de clic, la façon de savoir si CE clic-là n'est qu'un choix d'ÉCRAN. Table déclarative,
 * jamais un `if (action === …)` au fil de `netFlow` ; les intents absents d'ici voyagent tous.
 *
 * Le verdict se lit au MODE de ciblage courant (`electionLocale`) : c'est lui qui sait ce que son
 * clic-token fait, et le mode est le même des deux côtés du fil pour un ciblage armé localement.
 */
type ElectionLocale = (get: Get, args: readonly unknown[]) => boolean;
export const INTENT_ELECTION_LOCALE: Readonly<Record<string, ElectionLocale>> = {
  cliquerLaCase: (get, [, entite]) => typeof entite === 'string' && (currentTargetingMode(get).electionLocale?.(get, entite) ?? false),
} satisfies { readonly [A in ActionDeClasse<'invité'>]?: ElectionLocale };

/** Ce geste se joue-t-il ENTIER chez l'émetteur (aucun intent à envoyer) ? */
export function intentEluLocalement(get: Get, action: string, args: readonly unknown[]): boolean {
  return INTENT_ELECTION_LOCALE[action]?.(get, args) ?? false;
}

/** Le cavalier et la monture du couple désigné en attente (`pendingMountTarget`, LDB 14 l.181) : les ids que
 *  le choix `cibleDeMonture.cible` accepte. */
export const idsDuCoupleMonte = (s: Jeu): string[] => (s.pendingMountTarget ? [s.pendingMountTarget.riderId, s.pendingMountTarget.mountId] : []);
