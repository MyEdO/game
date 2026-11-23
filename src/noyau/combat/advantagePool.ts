/**
 * Orchestration, dans le noyau, du socle « Avantage de groupe » (AA 11, Annexe I — cf. `engine/advantagePool`).
 * La réserve par camp (`BattleState.advantagePools`) est la SOURCE DE VÉRITÉ ; chaque `Combatant.advantage`
 * en est la PROJECTION (`mirrorPools`), pour que les LECTEURS d'Avantage du moteur (attackModifiers,
 * baseTestMods…) lisent la réserve du camp de l'acteur sans changer une ligne. En mode Livre de base
 * (défaut), tout ce module écrit l'Avantage du combattant.
 */
import type { Combatant, Weapon } from '../../engine/types';
import type { OpsCtx } from '../../engine/ops';
import type { AttackResult } from '../../engine/combat';
import type { CompteDesCritiques } from '../../engine/critical';
import { isDoubleRoll } from '../../engine/tests';
import type { PendingAttack } from '../pendings';
import type { FaitDAvantage } from '../../engine/faits';
import { campOf } from '../../engine/relations';
import type { Get } from '../flowTypes';
import { advantageCapFor, avantageApresGain, avantageApresPerte } from '../../engine/advantage';
import { isOutOfAction } from '../../engine/conditions';
import {
  groupAdvantage, advantageCampOf, emptyPools, addToPool, mirrorPools, dominationTransfer,
  initialAdvantagePools, type AdvantageCamp, type AdvantagePools, type InitialAdvantageCircumstances,
} from '../../engine/advantagePool';
import { advantageTransferWeight, hasStealAdvantage, shieldAdvantageLevel, stealsOneAdvantage } from '../../engine/combatFeatures/dispatch';
import { t } from '../../i18n';
import type { EncounterDef } from '../monde/scene';
import { nomDe } from '../../engine/nom';

/** Réserve courante de la bataille (créée à la volée si absente). */
function poolsOf(battle: { advantagePools?: AdvantagePools }): AdvantagePools {
  return (battle.advantagePools ??= emptyPools());
}

/** Avantage DISPONIBLE pour dépense par `c` : en mode groupe, la réserve de SON camp (source de vérité) ;
 *  sinon son Avantage individuel (LDB). SOURCE UNIQUE des gardes d'abordabilité d'une dépense de camp.
 *  PUR : lit la bataille sans y créer de réserve. */
export function spendableAdvantage(battle: { advantagePools?: AdvantagePools } | null | undefined, c: Combatant): number {
  if (!groupAdvantage() || !battle) return c.advantage;
  return (battle.advantagePools ?? emptyPools())[advantageCampOf(c)];
}

/** La réserve des camps que lit un gain d'Avantage en mode groupe (copie), `null` hors de lui ou sans bataille. PUR. */
function reserveDe(battle: { advantagePools?: AdvantagePools } | null | undefined): AdvantagePools | null {
  return groupAdvantage() && battle ? { ...(battle.advantagePools ?? emptyPools()) } : null;
}

/** Le fait d'Avantage de `c` porté de `de` à `total`, `null` sans variation. */
function variation(c: Combatant, de: number, total: number): FaitDAvantage | null {
  return total === de ? null : { genre: 'avantage', cible: c.id, camp: campOf(c), valeur: total - de, total };
}

/** Le gain de `n` Avantages par `c`, qui en tient `avant` : en mode groupe (`reserve`), à la réserve de son camp, `total`
 *  = la réserve ; `null` sans variation. LDB 10 l.364 ; AA 13 l.51 ; LDB 14 l.197-198 ; AA 11 l.11-13. PUR. */
function gainDeCamp(reserve: AdvantagePools | null, c: Combatant, avant: number, n: number): FaitDAvantage | null {
  if (n <= 0 || (c.distractedRounds ?? 0) > 0) return null;
  if (reserve) return variation(c, reserve[advantageCampOf(c)], Math.max(0, reserve[advantageCampOf(c)] + n));
  return variation(c, avant, avantageApresGain(avant, n, advantageCapFor(c)));
}

/** Applique les faits d'Avantage `faits` (`null` : aucun) à leurs porteurs, pris dans `porteurs` : en mode groupe, la
 *  réserve du camp, re-projetée (`mirrorPools`) ; sinon l'Avantage du porteur. */
export function appliquerLAvantage(get: Get, faits: readonly (FaitDAvantage | null)[], porteurs: readonly Combatant[]): void {
  const battle = get().battle;
  for (const f of faits) {
    const c = f && porteurs.find((p) => p.id === f.cible);
    if (!f || !c) continue;
    if (groupAdvantage() && battle) {
      const pools = poolsOf(battle);
      pools[advantageCampOf(c)] = f.total;
      mirrorPools(pools, battle.combatants);
    } else c.advantage = f.total;
  }
}

/**
 * SEUL point de GAIN d'Avantage en combat (`gainDeCamp`, appliqué) ; rend son fait. Sans bataille (tests unitaires du
 * moteur), le gain est celui du combattant.
 */
export function campGain(get: Get, c: Combatant, n = 1): FaitDAvantage | null {
  const f = gainDeCamp(reserveDe(get().battle), c, c.advantage, n);
  appliquerLAvantage(get, [f], [c]);
  return f;
}

/** L'Avantage d'un coup, avant l'une de ses phases : celui de l'attaquant, de la cible, et la réserve des camps en mode
 *  groupe (`null` hors de lui). */
export interface EtatDAvantage { attaquant: number; cible: number; reserve: AdvantagePools | null }

/** L'état d'Avantage du coup de `attaquant` sur `cible`. PUR. */
export function etatDAvantage(battle: { advantagePools?: AdvantagePools } | null | undefined, attaquant: Combatant, cible: Combatant): EtatDAvantage {
  return { attaquant: attaquant.advantage, cible: cible.advantage, reserve: reserveDe(battle) };
}

/** Ce que l'Avantage d'une phase du coup devient : ses faits, l'état qu'ils laissent, le Renversement joué, et `aGagne`
 *  quand le générateur de la phase (l'attaquant à la touche, la cible après le coup) en prend la branche de gain. */
export interface AvantageDuCoup { faits: FaitDAvantage[]; etat: EtatDAvantage; renversement?: true; aGagne: boolean }

/**
 * L'AVANTAGE D'UN COUP, au jet comme à l'application ; ne tire rien. `touche` : celui de l'attaquant vainqueur, sauf
 * `differe` (Maniement de deux armes) ; `apresCoup` : celui du défenseur vainqueur, les remises à 0, le Porte-Bouclier.
 * Chaque mouvement lit l'état laissé par le précédent. LDB 13 l.123 ; LDB 10 ; AA 13 l.92-98 ; LDB 14 l.219 ;
 * AA 11 l.30-38 ; LDB 10 l.972 ; LDB 10 l.767-773. PUR.
 */
export function avantageDuCoup(
  phase: 'touche' | 'apresCoup', res: Pick<AttackResult, 'advantageTo' | 'hit' | 'woundsLost' | 'parryWeapon'>, arme: Weapon,
  attaquant: Combatant, cible: Combatant, etat: EtatDAvantage, differe: boolean,
): AvantageDuCoup {
  const e: EtatDAvantage = { ...etat, reserve: etat.reserve && { ...etat.reserve } };
  const faits: FaitDAvantage[] = [];
  let renversement = false;
  const avantDe = (c: Combatant): number => (c === attaquant ? e.attaquant : e.cible);
  const poser = (f: FaitDAvantage | null): void => {
    if (!f) return;
    faits.push(f);
    if (e.reserve) {
      e.reserve[advantageCampOf(f.cible === attaquant.id ? attaquant : cible)] = f.total;
      e.attaquant = e.reserve[advantageCampOf(attaquant)];
      e.cible = e.reserve[advantageCampOf(cible)];
    } else if (f.cible === attaquant.id) e.attaquant = f.total;
    else e.cible = f.total;
  };
  // AA 13 l.92-98 ; LDB 10.
  const vaincre = (gagnant: Combatant, perdant: Combatant): void => {
    if (arme.type === 'melee' && stealsOneAdvantage(gagnant)) {
      if (!e.reserve) return poser(gainDeCamp(null, gagnant, avantDe(gagnant), 1));
      const de = advantageCampOf(perdant);
      const vers = advantageCampOf(gagnant);
      if (e.reserve[de] > 0 && de !== vers) {
        renversement = true;
        poser(variation(perdant, e.reserve[de], e.reserve[de] - 1));
      }
      return poser(variation(gagnant, e.reserve[vers], e.reserve[vers] + 1));
    }
    const pris = avantDe(perdant);
    if (arme.type === 'melee' && hasStealAdvantage(gagnant) && pris > 1) {
      renversement = true;
      poser(variation(gagnant, avantDe(gagnant), avantageApresGain(avantDe(gagnant), pris, advantageCapFor(gagnant))));
      if (gagnant === attaquant) poser(variation(perdant, avantDe(perdant), 0));
      return;
    }
    poser(gainDeCamp(e.reserve, gagnant, avantDe(gagnant), 1));
  };
  let aGagne = false;
  if (phase === 'touche') {
    if (res.advantageTo === 'attaquant' && !differe) {
      vaincre(attaquant, cible);
      aGagne = true;
    }
  } else {
    if (res.advantageTo === 'defenseur') {
      vaincre(cible, attaquant);
      aGagne = true;
      if (!groupAdvantage()) poser(variation(attaquant, e.attaquant, 0));
    }
    if (res.hit && res.woundsLost && !groupAdvantage()) poser(variation(cible, e.cible, 0));
    const bouclier = res.advantageTo === 'attaquant' ? shieldAdvantageLevel(cible, res.parryWeapon) : 0;
    if (bouclier) {
      poser(gainDeCamp(e.reserve, cible, e.cible, bouclier));
      aGagne = true;
    }
  }
  return { faits, etat: e, ...(renversement ? { renversement: true } : {}), aGagne };
}

/** L'Avantage de l'attaquant du coup de `pa` est différé : Maniement de deux armes. LDB 10 l.767-773. */
export const avantageDiffere = (pa: Pick<PendingAttack, 'dualMode' | 'dualSecond'>, attaquant: Pick<Combatant, 'kind'>): boolean =>
  (!!pa.dualMode && attaquant.kind === 'heros') || !!pa.dualSecond;

/** Un dé reste-t-il à tirer avant l'après-coup du coup `res` : une Blessure critique au compte, le Critique de
 *  l'attaquant qui perd le Test opposé, le double défensif d'une Parade. LDB 13 l.183 ; LDB 14 l.3 ; LDB 62 l.278. */
function deAvantLApresCoup(res: AttackResult, arme: Weapon, compte: CompteDesCritiques): boolean {
  if (compte.critiques.length) return true;
  const ad = res.attackerDetail;
  const dd = res.defenderDetail;
  if (arme.type !== 'melee' || !dd) return false;
  return (!!ad?.success && isDoubleRoll(ad.roll) && !res.hit) || (dd.success && isDoubleRoll(dd.roll) && !!res.parryWeapon);
}

/** L'Avantage du coup `res` au jet (`avantageDuCoup`) : la touche, puis l'après-coup tant qu'aucun dé non tiré ne le
 *  précède (`deAvantLApresCoup`) ; rien d'une mort automatique. `compte` : celui du déroulé des Blessures critiques (`faitsAuJet`). LDB 16
 *  l.113. PUR. */
export function avantagesAuJet(
  battle: { advantagePools?: AdvantagePools } | null | undefined, res: AttackResult, arme: Weapon,
  attaquant: Combatant, cible: Combatant, compte: CompteDesCritiques, differe: boolean,
): FaitDAvantage[] {
  if (res.hit && res.autoKill) return [];
  const touche = avantageDuCoup('touche', res, arme, attaquant, cible, etatDAvantage(battle, attaquant, cible), differe);
  if (deAvantLApresCoup(res, arme, compte)) return touche.faits;
  const woundsLost = res.hit && (compte.blessures || compte.mortSubite) ? compte.blessures : res.woundsLost;
  return [...touche.faits, ...avantageDuCoup('apresCoup', { ...res, woundsLost }, arme, attaquant, cible, touche.etat, differe).faits];
}

/**
 * SEUL point de DÉPENSE d'Avantage en combat — symétrique de `campGain`. Mode groupe (AA 11 l.30 : « Les
 * Avantages des réserves d'Avantages des deux camps peuvent être dépensés… ») : `n` Avantages sont
 * DÉBITÉS de la réserve du camp de `c` (jamais sous 0), puis re-projetés sur tous les combattants — la
 * réserve reste la source de vérité (sans ça, `mirrorPools` restaurerait la projection au prochain sync).
 * Mode Livre de base (défaut) : dépense per-combattant `c.advantage = max(0, c.advantage − n)`, INCHANGÉE.
 * Sans bataille (tests unitaires du moteur), on retombe aussi sur la mutation per-combattant.
 */
export function campSpend(get: Get, c: Combatant, n: number): void {
  if (n <= 0) return;
  const solde = avantageApresDepense(get, c, n);
  const battle = get().battle;
  if (!groupAdvantage() || !battle) {
    c.advantage = solde;
    return;
  }
  const pools = poolsOf(battle);
  pools[advantageCampOf(c)] = solde;
  mirrorPools(pools, battle.combatants);
}

/** Fournisseur des hooks d'Avantage d'`OpsCtx` (`engine/ops.ts`) : l'op `gainAdvantage` gagne par
 *  `campGain`. */
export function campAdvantageHooks(get: Get): Required<Pick<OpsCtx, 'onGainAdvantage'>> {
  return { onGainAdvantage: (c, n) => campGain(get, c, n) };
}

/** Avantage que `c` lira APRÈS `campSpend(get, c, n)` — le solde que le débit pose, SOURCE UNIQUE du
 *  débit et de l'aperçu d'un geste qui le paie (le jet se tire sur l'Avantage restant). */
export function avantageApresDepense(get: Get, c: Combatant, n: number): number {
  return avantageApresPerte(spendableAdvantage(get().battle, c), Math.max(0, n));
}

/**
 * RESTITUTION d'Avantage dépensé pour un geste ANNULÉ avant d'être joué — l'inverse exact de
 * `campSpend` (même réserve, même projection). Ce n'est pas un GAIN : ni Distraire ni le plafond de
 * gain ne s'y appliquent, l'Avantage rendu sortait déjà de cette réserve.
 */
export function campRestitue(get: Get, c: Combatant, n: number): void {
  if (n <= 0) return;
  const battle = get().battle;
  if (!groupAdvantage() || !battle) {
    c.advantage += n;
    return;
  }
  const pools = poolsOf(battle);
  addToPool(pools, advantageCampOf(c), n);
  mirrorPools(pools, battle.combatants);
}

/**
 * Réconcilie la réserve du camp de `c` avec son Avantage individuel après qu'un OP a écrit DIRECTEMENT sur
 * la projection `c.advantage` sans passer par `campGain`/`campSpend` : `topUpAdvantage` (Redoutable,
 * MDG 16 l.11 : complète jusqu'à l'Indice) RELÈVE la réserve du camp. On reporte l'ÉCART (`c.advantage − réserve du camp`) sur la réserve puis on
 * re-projette — la réserve reste la source de vérité. No-op hors mode groupe (l'op a déjà tout fait). Idempotent
 * (après re-projection `c.advantage == réserve`, un 2ᵉ appel ne bouge rien).
 */
export function reconcileAdvantageToPool(get: Get, c: Combatant): void {
  const battle = get().battle;
  if (!groupAdvantage() || !battle) return;
  const pools = poolsOf(battle);
  const camp = advantageCampOf(c);
  if (c.advantage !== pools[camp]) {
    pools[camp] = Math.max(0, c.advantage);
    mirrorPools(pools, battle.combatants);
  }
}

/**
 * Fournisseur de `OpsCtx.onOpposingAdvantage` (`engine/ops.ts`, même patron que `onCorruption`) pour la
 * clause d'Avantage de groupe (AA) du Trait *Redoutable* (`MDG 16 l.13`) : « la créature génère un nombre
 * d'Avantages égal à son Indice dans le Trait *Redoutable* pour la réserve d'Avantages des adversaires. »
 * Branché par `turnHooks.fireTurnEdgeTriggers` sur le trigger `onTurnStart` ; appelé par l'op
 * `topUpAdvantage{feedOpposingPool:true}` (traits.json `redoutable`) SEULEMENT quand elle S'EXÉCUTE — le
 * garde-fou Empêtré/Inconscient/Surpris (MDG 16 l.11, même effet) vit dans le nœud `if` englobant de la
 * donnée, jamais reproduit ici (KIND-AGNOSTIQUE : aucun scan de Traits, aucun proxy sur `c.advantage`).
 * `n` = l'Indice PLEIN déjà résolu par l'op appelante. Crédite la réserve du camp OPPOSÉ de `c`, re-projette,
 * et journalise. Self-gardé par `groupAdvantage()` (la clause n'existe QUE sous les règles d'Avantage de
 * groupe d'AA), comme les autres primitives de ce module (`campGain`/`campSpend`/…).
 *
 * ORDRE : appelée PENDANT le même `applyOps` que le regain propre — l'op vient d'écrire `c.advantage`
 * DIRECTEMENT (projection), AVANT que `reconcileAdvantageToPool` (appelé APRÈS par `turnHooks`) n'ait pu
 * relever la réserve du CAMP DE `c` en conséquence. Sans ce rattrapage, `mirrorPools` re-projetterait ici
 * l'ancienne valeur de la réserve du camp de `c` PAR-DESSUS l'écriture directe qui vient d'avoir lieu —
 * on reconcilie donc la réserve du camp de `c` AVANT de créditer la réserve adverse (même logique que
 * `reconcileAdvantageToPool`, inlinée pour ne pas dépendre de l'ordre d'appel de l'appelant).
 */
export function creditOpposingAdvantage(get: Get, c: Combatant, n: number): string[] {
  if (n <= 0) return [];
  const battle = get().battle;
  if (!groupAdvantage() || !battle) return [];
  const pools = poolsOf(battle);
  const own = advantageCampOf(c);
  if (c.advantage !== pools[own]) pools[own] = Math.max(0, c.advantage ?? 0);
  const opposing: AdvantageCamp = own === 'allies' ? 'adversaires' : 'allies';
  addToPool(pools, opposing, n);
  mirrorPools(pools, battle.combatants);
  return [t('turn.redoutableOpposingFeed', { name: nomDe(c), n })];
}

/**
 * Transfert de domination de fin de Round (AA 11 l.44) — REMPLACE la décroissance per-combattant et le
 * Surnombre du Livre de base en mode groupe. Le camp le plus nombreux (Coude-à-coude compte pour deux,
 * AA 13 l.43) prend 1 Avantage à l'autre, ou +1 si l'autre est vide. Mute les réserves + re-projette.
 */
export function roundEndAdvantageTransfer(battle: { advantagePools?: AdvantagePools; combatants: Combatant[] }): void {
  const pools = poolsOf(battle);
  dominationTransfer(pools, battle.combatants, (c) => !isOutOfAction(c), (c) => advantageTransferWeight(c));
  mirrorPools(pools, battle.combatants);
}

/** Marqueurs de rencontre (AA 11 l.47-67) qui dérivent une circonstance d'Avantage initial — `EncounterDef`
 *  les porte en camp 'groupe'/'ennemis' (comme `surprise`) ; `startAdvantagePools` les convertit en `AdvantageCamp`. */
type EncounterAdvantageMarkers = Pick<EncounterDef, 'maneuverability' | 'threat' | 'terrain'>;

/** 'groupe'/'ennemis' (naming éditeur, cf. `EncounterDef.surprise`) → `AdvantageCamp` du moteur. */
function markerCamp(side: 'groupe' | 'ennemis'): AdvantageCamp {
  return side === 'groupe' ? 'allies' : 'adversaires';
}

/** Réserves de départ (AA 11 l.47-67). AUTO-dérivé de ce que le moteur/la rencontre connaissent au
 *  lancement : Surnombre (ratio de combattants actifs), Surprise (embuscade), et — via les marqueurs
 *  éditables de la rencontre (`EncounterDef.maneuverability`/`.threat`/`.terrain`) — Manœuvrabilité /
 *  Menace / Terrain. Marqueur absent → circonstance non applicable pour cette rencontre. */
export function startAdvantagePools(all: Combatant[], doSurprise: boolean, markers?: EncounterAdvantageMarkers): AdvantagePools {
  const allies = all.filter((c) => c.kind === 'heros' && !isOutOfAction(c)).length;
  const foes = all.filter((c) => c.kind !== 'heros' && !isOutOfAction(c)).length;
  const circ: InitialAdvantageCircumstances = {};
  if (allies > foes && foes > 0) circ.outnumber = { camp: 'allies', ratio: allies / foes };
  else if (foes > allies && allies > 0) circ.outnumber = { camp: 'adversaires', ratio: foes / allies };
  if (doSurprise) circ.surprise = 'adversaires'; // l'embuscade de rencontre surprend le groupe (camp adverse)
  if (markers?.maneuverability) circ.maneuverability = markerCamp(markers.maneuverability);
  if (markers?.threat) circ.threat = { camp: markerCamp(markers.threat.camp), tier: markers.threat.tier };
  if (markers?.terrain) circ.terrain = { camp: markerCamp(markers.terrain.camp), heavy: !!markers.terrain.heavy };
  return initialAdvantagePools(circ);
}
