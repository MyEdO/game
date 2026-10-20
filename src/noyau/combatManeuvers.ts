/**
 * MANŒUVRES de créature (attaques naturelles activées — LDB 85) : ENTITÉS de 1ʳᵉ classe ÉDITABLES
 * (`maneuvers.json`, effets en GameOp). Ce module FEUILLE porte le RÉSOLVEUR GÉNÉRIQUE unique
 * (`resolveManeuver`) — il REMPLACE les 5 appliers par type. La GÉOMÉTRIE/portée/opposition est moteur
 * (règle 3, dérivée de `ManeuverDef.targeting` + `range`/`blast`) ; les Dégâts (`wounds`) et États sont
 * la DONNÉE (`ManeuverDef.effects`, GameOp) appliquée par `applyTriggeredEffects` aux cibles GAGNÉES.
 *
 * Module FEUILLE : n'importe RIEN de `combatFlow`. Tout passe par les feuilles moteur/état (engine/*, ./path, ./footprint,
 * ./battleRng, ./combatLog, ./lineOfSight, ./triggeredEffects).
 *
 * Le jet d'ATTAQUANT (`rollManeuverAttacker`, CC/CT) est le SEUL influençable (Chance/Résilience de la
 * modale joueur) ; partagé par le flux joueur ET l'IA. Le DÉFENSEUR roule SON jet DANS le résolveur (jet
 * SUBI, montré au feed `evLines`) — pas de modale différée. `resolveManeuver` NE PPELLE PAS
 * `checkBattleOver` (l'appelant — store ou wrapper IA — le fait).
 */
import type { Get, Set as SetFn } from './flowTypes';
import type { BattleState, GameState } from '../state/store';
import { facingToward } from './monde/dir8';
import { Combatant, type Difficulty, CHAR_LABELS } from '../engine/types';
import { battleRng } from './battleRng';
import { evLines } from './combatLog';
import type { RNG } from '../engine/dice';
import { combatValue, combatBaseValue, defenseValue, defenseBaseValue, DEFENSE_LABEL } from '../engine/combat';
import { isVehicle } from '../engine/coque';
import { isInanimate } from '../engine/structures';
import { rollTest, resolveOpposed, hydrateTR, estJete, type TestResult } from '../engine/tests';
import { effectiveChar, bonus } from '../engine/characteristics';
import { isOutOfAction, applyZeroWounds, stacks, COND, cannotDefend } from '../engine/conditions';
import { isBestial, traitCapability, maneuverPaidByMovement } from '../engine/traits/dispatch';
import { isFrenzied } from '../engine/psychology';
import { creatureAttacks, attaquesNaturelles, attaqueNaturelle, type AttackKind, type CreatureAttack } from '../engine/creatureAttacks';
import { libelleDeValeur } from '../data/schemas/grammaire/meta';
import { attackKindSchema } from '../data/schemas/defs/maneuvers';
import { findTalentById, findPsychologyById, findManeuverById, combatStakeRef, dataLabel, type ManeuverDef, type ManeuverMeasure } from '../data';
import { registerCascadeApplier, startCascade } from './cascade';
import { freeCons } from './rollSeam';
import { defenseSurfaced } from './netOwnership';
import { inBattleId } from './monde/combatants';
import { touchActors } from './combatOrParty';
import type { CascadeStep } from './pendings';
import type { GameOp } from '../engine/ops';
import type { IconIdGenerated as IconId } from '../data/icones.generated';
import { sizeGap } from '../engine/size';

/** Op d'attaque gratuite (Frénésie/talent) — narrowing partagé. */
type GrantFreeAttackOp = Extract<GameOp, { op: 'grantFreeAttack' }>;
import { combatDistance } from './monde/footprint';
import { type Pt } from './monde/path';
import { chebyshev } from '../engine/grid';
import { combatantsWithinRadius } from './monde/combatGeometry';
import { smokeZone } from './monde/lineOfSight';
import { clampZoneTiles, inMapBounds } from './monde/zones';
import { applyTriggeredEffects, maneuverEffects } from './triggeredEffects';
import { canTakeAction } from '../engine/conditions';
import { isEngagedWith, longerThanShort, markAttacked } from '../engine/engagement';
import { areGrappling } from '../engine/grapple';
import { rule } from '../engine/policy';
import { campSpend } from './combat/advantagePool';
import { groupAdvantage } from '../engine/advantagePool';
import { bus, EVT } from './bus';
import { t } from '../i18n';

// ---------------------------------------------------------------------------
// Émission d'animation + énumération
// ---------------------------------------------------------------------------

/** Émet l'animation d'attaque d'une attaque SPÉCIALE de créature → AnimatedPlanToken joue la pose
 *  dédiée (creatureAttackPoses) ; les biped/spectraux jouent leur clip d'attaque générique. */
export function emitCreatureAttackAnim(attacker: Combatant, kind: string): void {
  bus.emit(EVT.ANIM_ATTACK, { from: attacker.id, to: attacker.id, kind: 'creature', defense: 'none', result: { hit: true }, creatureAttack: kind });
}

/** Chiffre flottant de Dégâts sur le pion touché — MÊME canal FX que les attaques/sorts (`useCombatFx`
 *  écoute `ANIM_FLOAT`). Sans ça, les Dégâts d'une manœuvre n'apparaissaient QUE dans le journal. */
function floatDamage(tgt: Combatant, wl: number): void {
  if (wl > 0) bus.emit(EVT.ANIM_FLOAT, { to: tgt.id, text: `-${wl}`, kind: 'damage' });
}
/** Étiquette flottante d'ÉTAT/issue (Pétrifié, Esquivé…) sur le pion — feedback visuel de la manœuvre. */
function floatTag(tgt: Combatant, text: string): void {
  bus.emit(EVT.ANIM_FLOAT, { to: tgt.id, text, kind: 'condition' });
}

/** HOOK de conséquence POST-TOUCHE d'une manœuvre (op IMPURE de géométrie) — injecté par le store
 *  (`setManeuverPostHitHook`), pointe sur l'entraînement de la Langue préhensile (LDB 85 l.213 : une proie
 *  plus petite Empêtrée est tirée vers la créature — pathing impur qui vit dans combatFlow). Appelé par
 *  `applyManeuverEffects` avec le nombre de pions *Empêtré* AVANT l'application des effets, pour que la
 *  voie SILENCIEUSE (non-héros/Surpris) ET la voie CASCADE (héros influençable) tirent à l'identique.
 *  Inversion de dépendance : ce module feuille reste sans import de combatFlow. Absent ⇒ no-op. */
type ManeuverPostHitHook = (get: Get, set: SetFn, attacker: Combatant, def: ManeuverDef, tgt: Combatant, hadEmpetre: number) => string[] | void;
let maneuverPostHitHook: ManeuverPostHitHook | undefined;
export function setManeuverPostHitHook(fn: ManeuverPostHitHook): void { maneuverPostHitHook = fn; }

/**
 * Application des EFFETS d'une manœuvre à UNE cible qui a PERDU l'opposition (ou n'en avait pas) — la
 * conséquence de `hitOne`, extraite en fonction PARTAGÉE : les effets AUTHORÉS (`def.effects`, GameOp :
 * Dégâts `wounds` + États + pétrification) sont appliqués avec la marge (`margin` : DR net + Avantage
 * variable) et l'`indice`, puis le chiffre flottant de Dégâts + la mise à 0 PB + la conséquence post-touche
 * (entraînement de la Langue). SOURCE UNIQUE : appelée par le résolveur SILENCIEUX (`resolveManeuver`) ET
 * par l'applier de cascade `maneuverDefense` (héros influençable). Renvoie les lignes de journal.
 */
export function applyManeuverEffects(
  get: Get, set: SetFn, attacker: Combatant, def: ManeuverDef, tgt: Combatant, indice: number, margin: number | undefined, rng: RNG,
): string[] {
  const lines: string[] = [];
  const hadEmpetre = stacks(tgt, COND.empetre);
  const before = tgt.wounds.current;
  lines.push(...applyTriggeredEffects(get, attacker, maneuverEffects(def), 'onHit', { victim: tgt, margin, indice, rng, set }));
  const wl = before - tgt.wounds.current;
  if (wl > 0) floatDamage(tgt, wl);
  if (tgt.wounds.current <= 0) applyZeroWounds(tgt);
  const pull = maneuverPostHitHook?.(get, set, attacker, def, tgt, hadEmpetre);
  if (pull && pull.length) lines.push(...pull);
  return lines;
}

/** Adversaire ADJACENT, encore actif, plus petit que `c` d'au moins `ecart` catégories de Taille.
 *  `targetId` borne la recherche à une cible précise (clic du joueur). LDB 85 l.387 */
export function cibleDEcartDeTaille(battle: BattleState, c: Combatant, ecart: number, targetId?: string): Combatant | undefined {
  return battle.combatants.find(
    (t) =>
      (targetId ? t.id === targetId : true) &&
      t.kind !== c.kind &&
      !isOutOfAction(t) &&
      !!t.pos &&
      !!c.pos &&
      combatDistance(c, t) <= 1 &&
      sizeGap(c.size, t.size) >= ecart,
  );
}

/** PRIX d'une attaque gratuite `def` pour `c` — SOURCE UNIQUE lue par `availableAttacks` (option du héros,
 *  débitée au commit) et par l'IA (`aiCreatureFreeAttacks`). LDB 85 l.387 ; LDB 85 l.314 */
export function freeAttackCost(battle: BattleState, c: Combatant, def: ManeuverDef): { advantage: number; movement: boolean } {
  return maneuverPaidByMovement(c.traits, def.id) && battle.movementUsed === 0 ? { advantage: 0, movement: true } : { advantage: def.advantageCost, movement: false };
}

/** PLAFOND par tour d'une attaque gratuite de créature, DÉRIVÉ de la donnée : `count` pour une attaque
 *  `perTentacle`, sinon 1 (Piétinement, toute attaque sans donnée de compte). SOURCE UNIQUE lue par
 *  `availableAttacks` (héros) et `aiCreatureFreeAttacks` (IA). LDB 85 l.237 ; LDB 85 l.47 ; LDB 85 l.387 ; LDB 85 l.405 */
export const plafondParTour = (a?: Pick<CreatureAttack, 'perTentacle' | 'count'>): number => (a?.perTentacle ? (a.count ?? 1) : 1);

/** Attaques gratuites `kind` qu'il RESTE à `c` ce tour : `plafondParTour(a)` moins le compteur partagé
 *  `freeAttacksThisTurn[kind]`. */
export const gratuitesRestantes = (c: Combatant, kind: AttackKind, a?: Pick<CreatureAttack, 'perTentacle' | 'count'>): number =>
  Math.max(0, plafondParTour(a) - (c.freeAttacksThisTurn?.[kind] ?? 0));

/** `target` est-elle une cible VALIDE de l'attaque gratuite `kind` de `c` ? SOURCE UNIQUE du survol, du
 *  clic et de l'IA. LDB 85 l.387 */
export function freeAttackTargetOk(battle: BattleState, c: Combatant, kind: AttackKind, target: Combatant): boolean {
  const ecart = attaqueNaturelle(c.traits ?? [], kind)?.def.ecartDeTailleMin;
  return ecart == null || !!cibleDEcartDeTaille(battle, c, ecart, target.id);
}

/** Icône par type de manœuvre (id du registre `src/ui/icons/` — la hotbar rend `<Icon id>`).
 *  Typé par l'union GÉNÉRÉE `IconId` (`src/data/icones.generated.ts`, hors de `ui`). */
export const MANEUVER_ICON: Record<AttackKind, IconId> = {
  arme: 'action/attack', morsure: 'creature/bite', caudale: 'creature/tail', cornes: 'creature/horns',
  souffle: 'creature/breath', vomi: 'creature/vomit', tentacules: 'creature/tentacles',
  etreinte: 'creature/squeeze', regard: 'creature/gaze', langue: 'creature/tongue', hurlement: 'creature/scream',
  pietinement: 'journal/charge',
};

/** Manœuvres de mêlée résolues comme un COUP D'ARME (via `pendingAttack` + `freeKind` →
 *  `applyAttackResult` : localisation/critique/FX/défense). Les autres (zone) passent par `pendingManeuver`
 *  (résolution propre). Classifieur partagé : `availableAttacks` (targeting melee/zone) + le survol. */
export const MELEE_MANEUVER_KINDS: AttackKind[] = ['morsure', 'caudale', 'tentacules', 'pietinement'];

/** ATTAQUE activable par le héros actif — descripteur UNIFIÉ (arme tenue + attaques gratuites/zone),
 *  SOURCE UNIQUE de la liste d'attaques (hotbar) ET de la résolution (`battleClickEntity`). `targeting`
 *  pilote la résolution : 'melee' → approche-puis-frappe (attackPlan + pendingAttack) ; 'zone' →
 *  resolveManeuver (pendingManeuver). `cost.action` = coûte l'Action (Arme), sinon gratuite ;
 *  `cost.movement` = paie l'Action de Mouvement (`freeAttackCost`). `reach`/`forceMelee` = Allonge de
 *  l'attaque (gratuites de mêlée = 1 ; Arme absente → attackPlan lit l'arme tenue). `freeKind`/`weaponUid`
 *  = charge utile de frappe (mêlée). */
export interface AttackOption {
  id: string;
  kind?: AttackKind;
  label: string;
  /** Id d'icône du registre `src/ui/icons/` (la hotbar rend `<Icon id>`). */
  icon: IconId;
  targeting: 'melee' | 'zone' | 'aucontact' | 'grapple';
  reach?: number;
  forceMelee?: boolean;
  cost: { action: boolean; advantage: number; movement?: boolean };
  weaponUid?: string;
  freeKind?: AttackKind;
  /** Pièce d'artillerie SERVIE à TIR INDIRECT (mortier/catapulte, `Weapon.indirect`) : le tir vise une CASE
   *  au sol (placeur de zone) au lieu d'un combattant. Absent/false = tir DIRECT (cible = combattant). */
  indirect?: boolean;
  def?: ManeuverDef;
  advantageMode?: 'fixed' | 'variable' | 'all';
}

/** Sources DONNÉE d'une attaque d'Arme gratuite « DISPONIBLE » (`grantFreeAttack when:'available'`) sur SON
 *  tour — Talents ET États PSY. L'état Frénésie porte LUI-MÊME son `grantFreeAttack` (LDB 21 l.33) → HÉROS
 *  comme ENNEMI, MÊME donnée (pas de jaloux). Renvoie l'op + son plafond /Round (`cap` = niveau du talent,
 *  ou 1 pour un État). SOURCE UNIQUE lue par `hasFreeWeaponAttack` (affordance UI) ET la résolution IA
 *  (`aiAvailableFreeAttack`) → l'attaque libre du frénétique passe par le MÊME résolveur que les attaques
 *  RÉACTIVES (`applyTalentFreeAttack`), plus de chemin frenzy-spécifique ni de jet en double. */
export function availableFreeAttackOps(c: Combatant): { op: GrantFreeAttackOp; cap: number }[] {
  const out: { op: GrantFreeAttackOp; cap: number }[] = [];
  for (const t of c.talents ?? [])
    for (const op of findTalentById(t.talentId)?.passive ?? [])
      if (op.op === 'grantFreeAttack' && op.when === 'available' && (op.activeIf !== 'frenzied' || isFrenzied(c)))
        out.push({ op, cap: t.times ?? 1 });
  for (const p of c.psychState ?? [])
    for (const op of findPsychologyById(p.type)?.passive ?? [])
      if (op.op === 'grantFreeAttack' && op.when === 'available')
        out.push({ op, cap: 1 });
  return out;
}

/** Une attaque d'Arme GRATUITE est-elle ENCORE disponible ce Round ? (compteur partagé `freeAttacksThisTurn
 *  ['arme']` < plafond de la source). Lue par `availableAttacks` + CombatConsole/IsoStage/turnEconomy. */
export const hasFreeWeaponAttack = (c: Combatant): boolean => {
  const used = c.freeAttacksThisTurn?.['arme'] ?? 0;
  return availableFreeAttackOps(c).some((s) => used < s.cap);
};

/** Adversaire de mêlée VALIDE pour l'action « Au Contact » d'un héros (LDB 62 l.176, Option « Longueur
 *  d'arme ») : ennemi vivant Engagé avec `mover` ET tel qu'une différence d'allonge soit PERTINENTE —
 *  l'un des deux porte une arme de mêlée plus longue que Courte (sinon « au contact » ne reclasse rien).
 *  Source UNIQUE de l'éligibilité (option de la hotbar + clic). Pure. */
export function auContactEligible(mover: Combatant, foe: Combatant): boolean {
  if (foe.kind === mover.kind || isOutOfAction(foe) || !isEngagedWith(mover, foe.id)) return false;
  const longer = (c: Combatant) => longerThanShort(c.weapons.find((x) => x.type === 'melee'));
  return longer(mover) || longer(foe);
}

/** Adversaire VALIDE pour l'action d'Empoignade d'un héros (LDB 14 l.161) : un combattant avec qui
 *  `mover` est déjà Empoigné, encore en action. Source UNIQUE de l'éligibilité (option de la hotbar +
 *  clic). Pure. */
export function grappleActionEligible(mover: Combatant, foe: Combatant): boolean {
  return areGrappling(mover, foe) && !isOutOfAction(foe); // `areGrappling` d'abord : ne sonde l'état que des partenaires
}

/** Attaques que le héros ACTIF peut lancer MAINTENANT — UNE liste à coût (Arme d'abord, puis gratuites/
 *  zone abordables, mutation Tentacule). Subsume l'attaque d'arme implicite ET la garde de Frénésie.
 *  Source : `active.weapons` (Arme) + `attaquesNaturelles` (gratuites) + les prédicats existants. */
export function availableAttacks(active: Combatant, battle: BattleState): AttackOption[] {
  // KIND-AGNOSTIQUE (un ennemi conduit par le MJ a le MÊME jeu d'attaques qu'un héros — bac-à-sable). Seul un
  // NAVIRE (`kind:'hero'`/`enemy`, MDG 13) est exclu : il n'a PAS d'attaque-arme PERSONNELLE (`active.weapons`
  // vide → l'option 'arme' planterait `attackPlan`) — ses « attaques » sont la Manœuvre + la Bordée via ses postes.
  // (Un combattant sans arme reste armé de ses poings/Bagarre : `attackPlan` gère l'arme vide, cf. player-maneuvers.)
  if (isVehicle(active)) return [];
  const out: AttackOption[] = [];
  // (0) ARME du Set actif — attaque-Action de base ET attaque CC GRATUITE de Frénésie (l.34), tant que
  //     l'Action OU la libre de Frénésie est dispo. `reach` absent → attackPlan lit l'arme tenue (Allonge,
  //     branche distance pour une arme à distance).
  const freeWeapon = hasFreeWeaponAttack(active);
  if ((!battle.acted && canTakeAction(active)) || freeWeapon)
    out.push({ id: 'arme', kind: 'arme', label: libelleDeValeur(attackKindSchema, 'arme'), icon: MANEUVER_ICON.arme, targeting: 'melee', cost: { action: !freeWeapon, advantage: 0 } });
  // (1) Attaques naturelles (`attaquesNaturelles`) : gratuites de MÊLÉE ou SPÉCIALES de zone. 'arme'
  //     (ci-dessus) et 'charge' (Cornes, auto) exclues. Mêmes prédicats d'abordabilité (Avantage RAW ou 1 si
  //     variable ; Action si trigger='action') ; une manœuvre d'écart de Taille exige sa cible au contact.
  for (const a of attaquesNaturelles(active.traits ?? [])) {
    if (a.kind === 'arme' || a.trigger === 'charge' || a.def.targeting === 'self') continue; // self : `selfManeuversOf`/battleSelfManeuver (flux dédié, hors attaque)
    if (a.def.ecartDeTailleMin != null && !cibleDEcartDeTaille(battle, active, a.def.ecartDeTailleMin)) continue; // LDB 85 l.387
    const cout = freeAttackCost(battle, active, a.def); // LDB 85 l.387 ; LDB 85 l.314
    const prix = cout.advantage;
    const minAdv = a.advantageMode === 'variable' ? 1 : prix;
    if (active.advantage < minAdv) continue;
    if (a.trigger === 'action' && (battle.acted || !canTakeAction(active))) continue;
    if (a.trigger === 'free' && gratuitesRestantes(active, a.kind, a) === 0) continue; // LDB 85 l.237 ; LDB 85 l.405
    const melee = MELEE_MANEUVER_KINDS.includes(a.kind);
    out.push({
      id: a.def.id, kind: a.kind, label: a.def.label, icon: MANEUVER_ICON[a.kind],
      targeting: melee ? 'melee' : 'zone',
      ...(melee ? { reach: 1, forceMelee: true, freeKind: a.kind } : { def: a.def, advantageMode: a.advantageMode }),
      cost: { action: a.trigger === 'action', advantage: prix, ...(cout.movement ? { movement: true } : {}) },
    });
  }
  // (2) Arme `nat-tentacule` du trait Tentacules (LDB 85 l.405) : plafond du trait qui l'octroie (`plafondParTour`,
  //     compteur partagé), 0 Avantage. Comme toute attaque de mêlée, elle s'APPROCHE (charge/rejoindre) → dispo dès
  //     qu'un ennemi existe (adjacence non requise).
  if (
    gratuitesRestantes(active, 'tentacules', creatureAttacks(active.traits ?? []).find((a) => a.kind === 'tentacules')) > 0 &&
    active.weapons.some((w) => w.uid === 'nat-tentacule') && !!active.pos &&
    battle.combatants.some((c) => c.kind !== active.kind && !isOutOfAction(c) && c.pos)
  )
    out.push({ id: 'tentacule', kind: 'tentacules', label: 'Tentacule', icon: 'creature/tentacles', targeting: 'melee', reach: 1, forceMelee: true, weaponUid: 'nat-tentacule', freeKind: 'tentacules', cost: { action: false, advantage: 0 } });
  // (3) Poste d'artillerie SERVI (`mannedPoste`, MDG 12-13) : « servir la pièce » = attaque DÉDIÉE portant
  //     l'arme du poste (`weaponUid` → canon ÉPINGLÉ, même si le servant porte une arme perso de mêlée pour
  //     l'abordage). Arc + portée INTRINSÈQUES (firedAttackBlock garde déjà l'arc de `w.mountSide`). Coûte
  //     l'Action ; `targeting:'melee'` = chemin approche-puis-frappe commun (une arme à distance y tire en
  //     place, comme l'option 'arme'). KIND-AGNOSTIQUE côté donnée (l'IA ennemie a son propre chemin). RÉSERVÉ
  //     au CHEF (`crewIds[0]`) : les membres SUPPORT (Arme d'équipe) occupent la pièce mais ne tirent pas.
  if (active.mannedPoste && active.mannedPoste.crewIds?.[0] === active.id && !battle.acted && canTakeAction(active)) {
    const w = active.weapons.find((x) => x.uid === active.mannedPoste!.item.uid);
    // Pièce INDIRECTE (mortier/catapulte, `w.indirect`) : vise une CASE (placeur de zone), pas un combattant
    // (AA 10 l.169/171). DIRECTE (canon/baliste) : ciblage de combattant classique. Flag DONNÉE, zéro liste en dur.
    if (w) out.push({ id: 'poste', label: `Servir ${w.label}`, icon: 'action/serve-engine', targeting: 'melee', weaponUid: w.uid, cost: { action: true, advantage: 0 }, ...(w.indirect ? { indirect: true } : {}) });
  }
  // (4) « Au Contact » (LDB 62 l.176, Option « Longueur d'arme », règle optionnelle `combat-weapon-reach`) :
  //     Test opposé de Corps à corps pour entrer dans la longueur d'arme. Dispo si la règle est ON, l'Action
  //     dispo, et un adversaire Engagé présente une différence d'allonge pertinente. Choix EXPLICITE de
  //     l'« Attaque ▾ », pas une frappe.
  if (rule('combat-weapon-reach') && !battle.acted && canTakeAction(active) && battle.combatants.some((c) => auContactEligible(active, c)))
    out.push({ id: 'aucontact', label: 'Au contact', icon: 'action/attack', targeting: 'aucontact', cost: { action: true, advantage: 0 } });
  // (5) Empoignade EN COURS (LDB 14 l.161) : action à son tour entre deux Empoignés — Test opposé de Force
  //     (Dégâts / Empêtré) ou « Briser » (Avantage supérieur). Dispo si l'Action est dispo et un adversaire
  //     est Empoigné. Choix EXPLICITE de l'« Attaque ▾ ».
  if (!battle.acted && canTakeAction(active) && battle.combatants.some((c) => grappleActionEligible(active, c)))
    out.push({ id: 'grapple', label: 'Empoignade', icon: 'creature/squeeze', targeting: 'grapple', cost: { action: true, advantage: 0 } });
  return out.filter((m, i) => out.findIndex((n) => n.id === m.id) === i);
}


/** Résout l'`AttackOption` à exécuter/prévisualiser : l'attaque ARMÉE (`selectedAttack`, défaut 'arme',
 *  repli sur 'arme' si périmée). `undefined` = mode
 *  non-attaque (cast/heal/focus/…) ou aucune attaque abordable. SOURCE UNIQUE partagée par le clic (store)
 *  et le survol (targeting). */
export function selectedAttackOption(active: Combatant, battle: BattleState): AttackOption | undefined {
  if (battle.action !== null) return undefined; // l'attaque ne vit qu'en mode neutre (cast/heal/… = leurs propres modes)
  const opts = availableAttacks(active, battle);
  const want = battle.selectedAttack ?? 'arme';
  return opts.find((o) => o.id === want) ?? opts.find((o) => o.id === 'arme'); // armée, repli sur l'Arme si périmée
}

// ---------------------------------------------------------------------------
// JET de l'attaquant (le SEUL influençable) — partagé flux joueur + IA
// ---------------------------------------------------------------------------

/** Jet d'attaquant d'une manœuvre (LDB 85) : CC (mêlée) ou CT (distance/zone). `difficulty` porte le
 *  bonus d'attaquant propre à la manœuvre (Vomissement : Facile +40 à courte distance, LDB 85 l.376) ;
 *  Intermédiaire par défaut. Hurlement n'a PAS de jet d'attaquant (chaque cible teste sa Résistance)
 *  → `stat` absent : `rollManeuverAttacker` n'est jamais appelé pour lui. */
export function rollManeuverAttacker(attacker: Combatant, stat: 'capacite-de-combat' | 'capacite-de-tir', rng: RNG, difficulty: Difficulty = 'intermediaire'): TestResult {
  const kind = stat === 'capacite-de-combat' ? 'melee' : 'ranged';
  return { ...rollTest(combatValue(attacker, kind), difficulty, rng), base: combatBaseValue(attacker, kind) }; // LDB 12 l.160
}

/** Difficulté du jet d'ATTAQUANT propre à une manœuvre (seul le Vomissement dévie du +0 : Facile +40
 *  à courte distance, LDB 85 l.376). Le store/IA passe ce résultat à `rollManeuverAttacker`. */
export function maneuverAttackerDifficulty(kind: AttackKind): Difficulty {
  return kind === 'vomi' ? 'facile' : 'intermediaire';
}

// ---------------------------------------------------------------------------
// RÉSOLVEUR GÉNÉRIQUE — UNE fonction joue TOUTE manœuvre depuis sa `ManeuverDef`
// ---------------------------------------------------------------------------

/** Géométrie d'une manœuvre en MÈTRES depuis sa mesure STRUCTURÉE (`{bonusOf?, plus?}`). `ref` = référent
 *  du Bonus (Attaquant pour la Portée, Cible au centre pour le Souffle — RAW l.251). PUR/moteur (règle 3) ;
 *  Dégâts/États restent data (`GameOp`). Vide ou ≤ 0 → null. Zéro regex (donnée déjà structurée). */
function measureMeters(spec: ManeuverMeasure | undefined, ref: Combatant): number | null {
  if (!spec) return null;
  const m = (spec.bonusOf ? bonus(effectiveChar(ref, spec.bonusOf)) : 0) + (spec.plus ?? 0);
  return m > 0 ? m : null;
}
/** Mètres → CASES (grille 2 m/case), min 1 ; null conservé. */
const tilesOf = (meters: number | null): number | null => (meters == null ? null : Math.max(1, Math.ceil(meters / 2)));

/** Jet du DÉFENSEUR opposé à la manœuvre, selon `def.defense`. `null` = pas d'opposition (Résistance/
 *  auto sans jet — le `test` op de l'effet roule lui-même, Hurlement). 'init' = Initiative (Regard) ;
 *  'auto' = meilleure réaction ; 'esquive'/'parade' = explicite. */
function defenderRoll(tgt: Combatant, defense: ManeuverDef['defense']): TestResult | null {
  if (!defense || defense === 'resist') return null;
  if (defense === 'init') { // Regard, opposé à l'Initiative (LDB 85)
    const init = effectiveChar(tgt, 'initiative');
    return { ...rollTest(init, 'intermediaire', battleRng()), base: init };
  }
  const mode = defense === 'auto' ? bestDefenseMode(tgt) : defense;
  return { ...rollTest(defenseValue(tgt, mode), 'intermediaire', battleRng()), base: defenseBaseValue(tgt, mode) }; // LDB 12 l.160
}

/** Émet le flash de ZONE (empreinte centre ± rayon, clippée à la scène) — montre pourquoi plusieurs
 *  cibles sont affectées (R7). Émis pour TOUTE manœuvre de zone (ennemi/joueur). */
function emitAoe(get: Get, center: Pt, radius: number, kind: AttackKind, type?: string): void {
  const sc = get().scene;
  const tiles: Pt[] = [];
  for (let dx = -radius; dx <= radius; dx++)
    for (let dy = -radius; dy <= radius; dy++) {
      const x = center.x + dx, y = center.y + dy;
      if (sc && inMapBounds(sc.dimensions, { x, y })) tiles.push({ x, y });
    }
  bus.emit(EVT.ANIM_AOE, { tiles, kind, type });
}

/** Ce que la GÉOMÉTRIE d'une manœuvre résout (cibles affectées, centre de zone ou cible unique, rayon
 *  d'impact ou de population) — pure, partagée par la résolution (`resolveManeuver`) et l'affichage
 *  (`maneuverDefensePending`). `chosenTarget` = clic joueur ; absent ou écarté → le plus proche. */
interface CiblesDeManoeuvre { affected: Combatant[]; center: Combatant | null; blast?: number; radius?: number }
function ciblesDeManoeuvre(battle: BattleState, attacker: Combatant, def: ManeuverDef, chosenTarget?: Combatant): CiblesDeManoeuvre {
  const alive = (c: Combatant) => c.kind !== attacker.kind && !isOutOfAction(c) && !!c.pos;
  const inPlay = (c: Combatant) => c.id !== attacker.id && !isOutOfAction(c) && !!c.pos; // population SANS camp (`allAround`)
  const nearest = (cands: Combatant[]) => cands.reduce((p, c) => (chebyshev(attacker.pos!, p.pos!) <= chebyshev(attacker.pos!, c.pos!) ? p : c));
  if (def.targeting === 'self') return { affected: [], center: null };
  if (def.targeting === 'zone') {
    const rangeTiles = tilesOf(measureMeters(def.range, attacker)) ?? Math.max(1, Math.ceil(bonus(effectiveChar(attacker, 'endurance')) / 2));
    const foes = combatantsWithinRadius(attacker.pos!, rangeTiles, battle.combatants, alive);
    const center = chosenTarget && alive(chosenTarget) && chebyshev(attacker.pos!, chosenTarget.pos!) <= rangeTiles
      ? chosenTarget : foes[0] ?? null; // `foes` est trié par distance (combatantsWithinRadius) → le plus proche d'abord
    if (!center) return { affected: [], center: null };
    // Rayon de Souffle : `blast` résolu contre la CIBLE au centre (« Bonus de Force » → BF de la cible, RAW l.251 ;
    // Vomi « 2 mètres » → littéral, 1 case). Aucune regex `/force/i` — la mesure structurée porte le référent.
    const blast = tilesOf(measureMeters(def.blast, center)) ?? 1;
    return { affected: combatantsWithinRadius(center.pos!, blast, battle.combatants, alive), center, blast };
  }
  if (def.targeting === 'allFoes' || def.targeting === 'allAround') {
    // Hurlement fantomatique (LDB 85 l.170) : « Toutes les créatures vivantes (ne possédant pas le trait
    // Mort-vivant) se trouvant à un nombre de mètres égal à l'Initiative » → `allAround`, aucun camp. Le
    // Mort-vivant se lit au TRAIT (capability `undead`), PAS au Groupe bestiaire (folder « Morts sans
    // repos » sans le Trait, ex. Goule de crypte, reste ciblable — cf. domainAttributes.test.ts).
    // `allFoes` sert les textes qui DÉSIGNENT le camp (Hurlement de la Bête indomptable, Middenheim 04
    // l.11 : « effectuer une attaque gratuite de hurlement contre ses ennemis »).
    // « créatures vivantes » exclut aussi l'objet INANIMÉ (structure de siège, véhicule-coque) — dans les
    // DEUX populations : un chariot n'entend pas un hurlement.
    const radius = Math.max(1, Math.ceil(effectiveChar(attacker, 'initiative') / 2));
    const pop = def.targeting === 'allAround' ? inPlay : alive;
    const affected = combatantsWithinRadius(attacker.pos!, radius, battle.combatants, (c) => pop(c) && !isInanimate(c) && !traitCapability(c.traits, 'undead'));
    return { affected, center: null, radius };
  }
  // melee / ranged : cible unique (clic joueur, ou la plus proche pour l'IA/auto).
  const foes = battle.combatants.filter(alive);
  const tgt = chosenTarget && alive(chosenTarget) ? chosenTarget : foes.length ? nearest(foes) : null;
  return { affected: tgt ? [tgt] : [], center: tgt };
}

/** Les défenseurs SURFACÉS d'une manœuvre — influençables, ils jouent leur défense en cascade
 *  (`maneuverDefense`) et rien ne leur est appliqué à la résolution. MÊME prédicat que TOUTES les autres
 *  défenses (`defenseSurfaced`, #989). Opposition réelle exigée : jet d'attaquant présent, défense ≠
 *  `resist`, effets à subir (pas de fumée pure) ; un défenseur Surpris (`cannotDefend`) ne réagit pas. */
function defenseursSurfacesDeManoeuvre(s: GameState, def: ManeuverDef, atk: TestResult | null, affected: Combatant[]): Combatant[] {
  const canDefend = !!atk && !!def.defense && def.defense !== 'resist' && (def.effects?.length ?? 0) > 0;
  return canDefend ? affected.filter((t) => defenseSurfaced(s, t) && !isOutOfAction(t) && !cannotDefend(t)) : [];
}

/** La manœuvre DÉCLARÉE (`pendingManeuver`) passe-t-elle la main à la défense d'un défenseur surfacé ?
 *  Patron `surfacedDefensePending` : source unique, partagée par l'affichage et la résolution. */
export function maneuverDefensePending(s: GameState): boolean {
  const pm = s.pendingManeuver;
  const battle = s.battle;
  if (!pm?.result || !battle) return false;
  const attacker = inBattleId(battle, pm.attackerId);
  if (!attacker?.pos) return false;
  const def = creatureAttacks(attacker.traits ?? []).find((x) => x.def.id === pm.maneuverId)?.def;
  if (!def) return false;
  const chosen = pm.targetId ? inBattleId(battle, pm.targetId) : undefined;
  return defenseursSurfacesDeManoeuvre(s, def, pm.result, ciblesDeManoeuvre(battle, attacker, def, chosen).affected).length > 0;
}

/**
 * RÉSOLVEUR UNIQUE de manœuvre — joue ENTIÈREMENT une `ManeuverDef` (remplace applyMan{Area,Tongue,
 * Wail,Gaze,ChillGrasp}). `atk` = jet d'attaquant FIGÉ (influencé par la modale joueur ; null = pas de
 * jet, Hurlement), `spent` = Avantage dépensé, `chosenTarget` = clic joueur (victime mêlée/distance, ou
 * centre de zone). La GÉOMÉTRIE dérive de `def.targeting`+`range`/`blast` ; les effets AUTHORÉS
 * (`def.effects`, GameOp : Dégâts `wounds` + États) sont appliqués aux cibles GAGNÉES avec l'Indice
 * (`{indiceOf}`) et la marge (`ctx.sl` : slThreshold/valuePerSL). NE PPELLE PAS `checkBattleOver`.
 */
export function resolveManeuver(
  get: Get, set: SetFn, attacker: Combatant, def: ManeuverDef, indice: number, atk: TestResult | null, spent: number, chosenTarget?: Combatant,
): boolean {
  const battle = get().battle;
  if (!battle || battle.over || !attacker.pos) return false;
  campSpend(get, attacker, spent); // dépense l'Avantage : réserve du camp (mode groupe AA 11 l.30-38) / le combattant (LDB)
  const rng = battleRng();
  const lines: string[] = [t('manv.trigger', { name: attacker.label, label: def.label })];
  // Orientation du geste : l'attaquant vise le centre RÉELLEMENT résolu plus bas (la cible cliquée peut
  // être écartée — morte, hors portée — et le souffle recentré sur le plus proche). UNE écriture par
  // manœuvre ; cible = SOI (transformation) ou case identique ⇒ delta nul, facing inchangé ; population
  // centrée sur l'attaquant (`allAround`/`allFoes`) ⇒ rien à viser. Seul l'ATTAQUANT tourne, à la
  // différence de la passe d'armes d'`applyAttackResult` (combatFlow.ts:2406) qui tourne AUSSI le
  // défenseur : une manœuvre touche N cibles ou une zone, et son défenseur n'y répond par aucun jet orienté.
  const faceTarget = (tgt?: Combatant | null): void => {
    const from = attacker.pos!, to = tgt?.pos;
    if (!to || tgt!.id === attacker.id || (to.x === from.x && to.y === from.y)) return;
    set((s: GameState) => ({ facing: { ...s.facing, [attacker.id]: facingToward(from, to) } }));
  };
  emitCreatureAttackAnim(attacker, def.kind);
  const flushLog = () => {
    set({ battle: { ...get().battle!, log: [...get().battle!.log, ...evLines(lines, 'attack', attacker.id)] } });
    bus.emit(EVT.SCENE_DIRTY);
  };

  /** Chemin SILENCIEUX (défenseur NON influençable — cible non-héros / Surpris / sans opposition) : jet du
   *  défenseur (selon `def.defense`), opposition, et — si l'attaquant gagne (ou pas d'opposition) — les
   *  effets AUTHORÉS via la SOURCE PARTAGÉE `applyManeuverEffects` (identique à la voie cascade). */
  const hitOne = (tgt: Combatant): void => {
    const drow = defenderRoll(tgt, def.defense);
    let margin: number | undefined;
    if (drow) {
      const opp = resolveOpposed(atk ?? drow, drow);
      if (!opp.attackerWins) { lines.push(t('manv.resists', { name: tgt.label })); floatTag(tgt, def.defense === 'init' ? t('fx.resists') : t('fx.dodge')); return; }
      // Marge = DR net du vainqueur (+Avantage dépensé pour les manœuvres à Avantage VARIABLE, Regard l.238).
      margin = opp.netSL + (def.advantageMode === 'variable' ? spent : 0);
    }
    lines.push(...applyManeuverEffects(get, set, attacker, def, tgt, indice, margin, rng));
  };

  // SUR SOI (transformation, mue, auto-buff) : aucune cible adverse ni opposition — jamais de cascade.
  if (def.targeting === 'self') {
    lines.push(...applyTriggeredEffects(get, attacker, maneuverEffects(def), 'onHit', { victim: attacker, indice, rng, set }));
    flushLog();
    return false;
  }

  // Cibles AFFECTÉES (`ciblesDeManoeuvre`, la géométrie partagée avec l'affichage) + émissions propres
  // à la géométrie.
  const { affected, center, blast, radius } = ciblesDeManoeuvre(battle, attacker, def, chosenTarget);
  if (def.targeting === 'zone') {
    if (!center) { flushLog(); return false; }
    faceTarget(center); // le centre de la zone = ce que l'attaquant vise (cliqué, ou recentré sur le plus proche)
    emitAoe(get, center.pos!, blast!, def.kind, def.label);
    // Fumée (souffle-fumee, LDB 85 l.329) : GÉOMÉTRIE moteur (pas un GameOp) ; aucune zone à BE 0.
    const dur = def.id === 'souffle-fumee' ? bonus(effectiveChar(attacker, 'endurance')) : 0;
    if (dur > 0) {
      const rawTiles = clampZoneTiles(smokeZone(attacker.pos!, center.pos!, blast!), get().scene?.dimensions); // bornée à la carte au site d'écriture
      // z propagé (cf. placeZoneFromOp/combatFlow, zoneAreaTiles §782/#799) : la fumée posée à l'étage du centre
      // ne bloque pas la Ligne de Vue à un autre étage de même (x,y).
      const cz = center.pos!.z;
      const tiles = cz ? rawTiles.map((tl) => ({ ...tl, z: cz })) : rawTiles;
      const zones = [...(get().battle!.zones ?? []), { label: t('manv.smokeZone'), tiles, rounds: dur, blocksLoS: true }];
      lines.push(t('manv.smoke', { dur }));
      set({ battle: { ...get().battle!, zones } });
    }
  } else if (def.targeting === 'allFoes' || def.targeting === 'allAround') {
    emitAoe(get, attacker.pos, radius!, def.kind, def.label);
  } else {
    faceTarget(center);
  }
  // Trace orientée du Round (LDB 85 l.383, `agressifEnvers`) — MÊME garde qu'aux deux sites de `applyAttackResult` :
  // jamais contre un objet INANIMÉ (il n'a ni psychologie ni Engagement).
  for (const t of affected) if (!isInanimate(t)) markAttacked(attacker, t);

  // Split : défenseurs SURFACÉS influençables (défense en cascade, Chance/Résilience) vs le reste
  // (silencieux, IA en masse). MÊME prédicat que TOUTES les autres défenses (`defenseSurfaced`, #989 —
  // un siège humain QUELCONQUE tient le défenseur, fût-il distant) : c'est la parité `maybeOpenDefense`
  // annoncée ci-dessus, et une défense de zone ne peut pas répondre depuis une autre table de vérité.
  const heroDefenders = defenseursSurfacesDeManoeuvre(get(), def, atk, affected);
  for (const tgt of affected) if (!heroDefenders.includes(tgt)) hitOne(tgt);
  flushLog();
  if (heroDefenders.length) {
    openManeuverDefenseCascade(get, set, attacker, def, indice, atk!, spent, heroDefenders);
    return true; // tour SUSPENDU : reprise via `resumeManeuverDefense` à la fermeture de la cascade
  }
  // Un nœud Flow `test` DANS les effets (Hurlement : « Test de Résistance/Calme ou Brisé », LDB 85) a pu
  // ouvrir une cascade `triggeredTest` INFLUENÇABLE pour un héros MANUEL (chemin silencieux `hitOne` →
  // `applyManeuverEffects` → `applyTriggeredEffects` → testRouter cadence-aware). On la TAGUE `maneuverResume`
  // pour que sa fermeture reprenne le tour de la créature — MÊME mécanisme que la défense de zone
  // (dispatchCascadeDone → resumeManeuverDefense), sans `maneuverDefense` bidon pour un Test simple.
  const p = get().pendingCascade;
  if (p && p.purpose === 'combat' && !p.maneuverResume) {
    set({ pendingCascade: { ...p, maneuverResume: { attackerId: attacker.id, free: def.activation === 'free' } } });
    return true; // tour SUSPENDU : le Test de Résistance influençable tient la main
  }
  return false;
}

/** Valeur de Test de la RÉACTION opposée à une manœuvre pour `tgt` (mirroir de `defenderRoll`) : Initiative
 *  (Regard pétrifiant), sinon Esquive/Parade (`auto` = la meilleure). Portée par l'étape de cascade (base/target). */
function maneuverDefenseValue(tgt: Combatant, defense: NonNullable<ManeuverDef['defense']>): number {
  if (defense === 'init') return effectiveChar(tgt, 'initiative');
  const mode = defense === 'auto' ? bestDefenseMode(tgt) : (defense === 'resist' ? 'esquive' : defense);
  return defenseValue(tgt, mode);
}
/** Libellé du cadre de jet de la réaction (« Initiative » / « Esquive » / « Parade ») — dépend de `tgt` pour `auto`. */
function maneuverDefenseLabel(tgt: Combatant, defense: NonNullable<ManeuverDef['defense']>): string {
  if (defense === 'init') return CHAR_LABELS.initiative;
  const mode = defense === 'auto' ? bestDefenseMode(tgt) : (defense === 'resist' ? 'esquive' : defense);
  return DEFENSE_LABEL[mode];
}

/** Ouvre la cascade de DÉFENSE à une manœuvre de zone IA : UNE étape `maneuverDefense` INFLUENÇABLE par héros
 *  ciblé (jumeau de la cascade de Psychologie), le jet d'attaquant FIGÉ dans `meta.opposed.aT`. À la
 *  fermeture, le store reprend le tour de la créature (`maneuverResume`). */
function openManeuverDefenseCascade(
  get: Get, set: SetFn, attacker: Combatant, def: ManeuverDef, indice: number, atk: TestResult, spent: number, heroes: Combatant[],
): void {
  const attackerLabel = dataLabel(def.label);
  const steps: CascadeStep[] = heroes.map((h) => {
    const base = maneuverDefenseValue(h, def.defense!);
    return {
      id: `maneuverDef-${h.id}`,
      kind: 'maneuverDefense',
      actorId: h.id,
      rollLabel: maneuverDefenseLabel(h, def.defense!),
      base,
      target: base, // Test opposé Intermédiaire (+0) → cible = valeur nue ; l'issue vient de resolveOpposed(aT)
      label: attackerLabel,
      stake: combatStakeRef('maneuverDefense', { entryId: def.id }),
      meta: {
        opposed: { aT: atk, attackerId: attacker.id, attackerName: attacker.label, attackerLabel },
        maneuverDefense: { attackerId: attacker.id, maneuverId: def.id, indice, spent },
      },
    };
  });
  startCascade(get, set, { title: attackerLabel, purpose: 'combat', steps });
  const p = get().pendingCascade;
  if (p) set({ pendingCascade: { ...p, maneuverResume: { attackerId: attacker.id, free: def.activation === 'free' } } });
}

/** Applier de l'étape `maneuverDefense` (héros influençable) — SOURCE UNIQUE de la conséquence : le jet du
 *  défenseur est déjà résolu par `FLOWS.cascade` (`meta.opposed` → `resolveOpposed(défenseur, aT)`), on lit
 *  son issue. RÉSISTE (`result.success`) → aucun effet ; sinon l'attaquant l'emporte → marge nette (DR net +
 *  Avantage variable) → effets via `applyManeuverEffects` (le MÊME que le chemin silencieux). Le Critique se
 *  FOLDE dans la MÊME cascade (les ops de Dégâts poussent une révélation → `pushReveal` l'append). */
registerCascadeApplier('maneuverDefense', (get, set, step, hero) => {
  if (!hero || !estJete(step.result)) return;
  const md = step.meta?.maneuverDefense;
  const opp = step.meta?.opposed;
  if (!md || !opp) return;
  const attacker = inBattleId(get().battle, md.attackerId);
  const def = findManeuverById(md.maneuverId);
  if (!attacker || !def) return;
  const syncManeuver = () => {
    set(touchActors(get()));
    bus.emit(EVT.SCENE_DIRTY);
  };
  // `FLOWS.cascade` opposé : `success` = le DÉFENSEUR RÉSISTE (l'attaquant ne l'emporte pas) → aucun effet.
  if (step.result.success) {
    floatTag(hero, def.defense === 'init' ? t('fx.resists') : t('fx.dodge'));
    syncManeuver();
    return { consequences: freeCons([t('manv.resists', { name: hero.label })]) };
  }
  // L'attaquant l'emporte : on re-oppose le jet influencé du défenseur (reproduit `resolveOpposed` de la
  // cascade) pour la MARGE NETTE (RAW Regard : +1 DR/Avantage variable), puis on applique les effets.
  const drow = hydrateTR({ roll: step.result.roll, target: step.result.target, base: step.base, success: step.result.roll <= step.result.target, sl: step.result.sl });
  const margin = resolveOpposed(opp.aT, drow).netSL + (def.advantageMode === 'variable' ? md.spent : 0);
  const journal = applyManeuverEffects(get, set, attacker, def, hero, md.indice, margin, battleRng());
  syncManeuver();
  return { consequences: freeCons(journal) };
});

/** Le défenseur choisit sa meilleure réaction : Parade (Corps à corps) ou Esquive (Agilité + avances,
 *  pénalité d'Encombrement incluse) — la plus haute valeur. Vit ICI (feuille) : SOURCE UNIQUE,
 *  importée par combatFlow/rollFlows sans cycle.
 *  Bestial (LDB 85 l.59) : « En défense, elle peut seulement utiliser la Compétence Esquive. » */
export function bestDefenseMode(defender: Combatant): 'parade' | 'esquive' {
  if (isBestial(defender.traits)) return 'esquive';
  return defenseValue(defender, 'esquive') > defenseValue(defender, 'parade') ? 'esquive' : 'parade';
}

// ---------------------------------------------------------------------------
// Manœuvres de TALENT liées à l'Avantage (Battement / Distraire) — LDB 10 / AA
// ---------------------------------------------------------------------------

/** Battement (`LDB 10 l.103` · `AA 13 l.15-17` · `LDB 13 l.114`) est-il déclarable par `attacker` contre
 *  `foe` ? Conditions mesurées ici : camp opposé et actif, `foe` armé, `sizeGap`, Engagement. */
export function battementEligible(attacker: Combatant, foe: Combatant): boolean {
  if (foe.kind === attacker.kind || isOutOfAction(foe)) return false;
  const foeArmed = (foe.weapons ?? []).some((w) => w.type === 'melee' || w.type === 'ranged');
  return foeArmed && sizeGap(foe.size, attacker.size) < 1 && isEngagedWith(attacker, foe.id);
}

/** Avantage retiré à l'adversaire par un Battement RÉUSSI de `dr` DR : LDB (l.103) « −1 et −1 par DR » ;
 *  variante « Avantage de groupe » (AA 13 l.17) « −1, et −1 de plus si 6 DR ». PUR — SOURCE UNIQUE du barème. */
export function battementRemoval(dr: number): number {
  return groupAdvantage() ? 1 + (dr >= 6 ? 1 : 0) : 1 + Math.max(0, dr);
}

/**
 * Résout un Battement (Action) de `attacker` contre `foe` — `atk` = jet de Corps à corps FIGÉ (NON opposé,
 * influençable côté héros). Sur SUCCÈS, retire l'Avantage adverse via `campSpend` (débite l'individu en
 * LDB, la réserve du camp adverse en mode groupe) selon `battementRemoval(DR)`. Renvoie la ligne de journal.
 * MUTE `foe` (et la réserve). Ne consomme PAS l'Action (l'appelant pose `acted`). Ne touche pas `checkBattleOver`.
 */
export function resolveBattement(get: Get, attacker: Combatant, foe: Combatant, atk: TestResult): string {
  if (!atk.success) return t('manv.battementFail', { name: attacker.label, foe: foe.label });
  const removed = battementRemoval(atk.sl);
  const before = groupAdvantage() ? undefined : foe.advantage;
  campSpend(get, foe, removed); // retire de la réserve du camp adverse (mode groupe) / de l'Avantage du foe (LDB)
  const n = before != null ? before - foe.advantage : removed;
  return t('manv.battement', { name: attacker.label, foe: foe.label, n });
}

/** Distraire (`LDB 10 l.364` · `AA 13 l.51`) est-il déclarable par `attacker` contre `foe` ? Conditions
 *  mesurées ici : camp opposé, `foe` actif. */
export function distraireEligible(attacker: Combatant, foe: Combatant): boolean {
  return foe.kind !== attacker.kind && !isOutOfAction(foe);
}

/**
 * Résout un Distraire (Mouvement) — Test OPPOSÉ Athlétisme (attaquant) vs Calme (défenseur). `atk` = jet
 * d'Athlétisme FIGÉ (influençable côté héros), `defRoll` = jet de Calme du défenseur (subi). Sur victoire
 * de l'attaquant, `foe` est DISTRAIT (`distractedRounds = 2`) → il ne génère aucun Avantage jusqu'à la fin
 * du prochain Round (`campGain` le refuse). Renvoie la ligne de journal. MUTE `foe`. Ne touche pas `battle`.
 */
export function resolveDistraire(attacker: Combatant, foe: Combatant, atk: TestResult, defRoll: TestResult): string {
  const opp = resolveOpposed(atk, defRoll);
  if (!opp.attackerWins) return t('manv.distraireFail', { name: attacker.label, foe: foe.label });
  foe.distractedRounds = 2; // jusqu'à la fin du PROCHAIN Round (2 franchissements de Round)
  return t('manv.distraire', { name: attacker.label, foe: foe.label });
}

/** Niveaux de Compétence NUS du Distraire (`LDB 09 l.17`) : Athlétisme sur AGILITÉ pour l'attaquant,
 *  Calme sur FORCE MENTALE pour le défenseur — Caractéristique effective + Augmentations, sans aucun
 *  modificateur. SOURCE des jets de `resolveDistraire`, et grandeurs de son départage. Pur. */
export function distraireAttackValue(c: Combatant): number {
  return effectiveChar(c, 'agilite') + (c.skills.find((s) => s.id === 'athletisme')?.advances ?? 0);
}
export function distraireDefenseValue(c: Combatant): number {
  return effectiveChar(c, 'force-mentale') + (c.skills.find((s) => s.id === 'calme')?.advances ?? 0);
}

/** Adversaires ÉLIGIBLES au Battement de `attacker` (LDB 10 l.103) — SOURCE UNIQUE : gate de la hotbar,
 *  défaut de l'ouverture, picker de la modale. Pur. */
export function battementFoes(attacker: Combatant, battle: BattleState): Combatant[] {
  return battle.combatants.filter((c) => battementEligible(attacker, c));
}

/** Adversaires ÉLIGIBLES au Distraire de `mover` (`LDB 10 l.364` · `AA 13 l.51`) — SOURCE UNIQUE : gate
 *  de la hotbar, défaut de l'ouverture, picker de la modale. Pur. */
export function distraireFoes(mover: Combatant, battle: BattleState): Combatant[] {
  return battle.combatants.filter((c) => distraireEligible(mover, c) && !!c.pos);
}

/** Ouvre la modale de Battement d'un héros (LDB 10 l.103 / AA 13 l.17) : Action, Test de Corps à corps
 *  NON opposé. AUCUN jet ici — il se fait au « Lancer » (`battementRoll`). */
export function startBattement(_get: Get, set: SetFn, attacker: Combatant, foe: Combatant): void {
  set({ pendingBattement: { attackerId: attacker.id, foeId: foe.id, result: null } });
}

/** Ouvre la modale de Distraire d'un héros (LDB 10 l.364 / AA 13 l.51) : Mouvement, Test OPPOSÉ
 *  Athlétisme vs Calme. Le jet de Calme du foe est tiré et FIGÉ d'avance (pattern Désengagement/
 *  Au Contact) ; seul l'Athlétisme du mover se (re)joue dans la modale. */
export function startDistraire(_get: Get, set: SetFn, mover: Combatant, foe: Combatant): void {
  const defValue = distraireDefenseValue(foe); // valeur NUE (carac effective + avances, LDB 09 l.17)
  const defRoll = { ...rollTest(defValue, 'intermediaire', battleRng()), base: defValue }; // Calme du foe, figé (jamais relancé)
  set({ pendingDistraire: { moverId: mover.id, foeId: foe.id, atk: null, defRoll, result: null } });
}
