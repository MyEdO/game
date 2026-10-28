/**
 * Orchestration, dans le noyau, du socle « Avantage de groupe » (AA 11, Annexe I — cf. `engine/advantagePool`).
 * La réserve par camp (`BattleState.advantagePools`) est la SOURCE DE VÉRITÉ ; chaque `Combatant.advantage`
 * en est la PROJECTION (`mirrorPools`), pour que les LECTEURS d'Avantage du moteur (attackModifiers,
 * baseTestMods…) lisent la réserve du camp de l'acteur sans changer une ligne. En mode Livre de base
 * (défaut), tout ce module délègue au primitif per-combattant `gainAdvantage` (comportement INCHANGÉ).
 */
import type { Combatant } from '../../engine/types';
import type { OpsCtx } from '../../engine/ops';
import type { Get } from '../flowTypes';
import { gainAdvantage, avantageApresPerte } from '../../engine/advantage';
import { isOutOfAction } from '../../engine/conditions';
import {
  groupAdvantage, advantageCampOf, emptyPools, addToPool, mirrorPools, dominationTransfer,
  initialAdvantagePools, type AdvantageCamp, type AdvantagePools, type InitialAdvantageCircumstances,
} from '../../engine/advantagePool';
import { advantageTransferWeight } from '../../engine/combatFeatures/dispatch';
import { t } from '../../i18n';
import type { EncounterDef } from '../monde/scene';

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

/**
 * SEUL point de GAIN d'Avantage en combat. Mode groupe (AA 11 l.11-13) : `n` Avantages sont crédités à
 * la réserve du camp de `c`, puis projetés sur tous les combattants. Mode Livre de base : `gainAdvantage`
 * per-combattant, INCHANGÉ. Sans bataille (tests unitaires du moteur), on retombe sur le primitif.
 */
export function campGain(get: Get, c: Combatant, n = 1): void {
  if (n <= 0) return; // (gainAdvantage ignore déjà n≤0 ; la réserve idem)
  if ((c.distractedRounds ?? 0) > 0) return; // Distraire (LDB 10 l.364 / AA 13 l.51) : ce combattant ne génère aucun Avantage (ni pour lui, ni pour sa réserve)
  const battle = get().battle;
  if (!groupAdvantage() || !battle) {
    gainAdvantage(c, n);
    return;
  }
  const pools = poolsOf(battle);
  addToPool(pools, advantageCampOf(c), n);
  mirrorPools(pools, battle.combatants);
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
 * Renversement — variante « Avantage de groupe » (AA 13 l.98) : `thief` prend 1 Avantage dans la réserve
 * ADVERSE (celle de `victim`) et l'ajoute à la sienne. Réserve adverse vide → il gagne simplement +1
 * (meilleur auto-choix : « au lieu de gagner +1, prendre 1 »). Retombe sur `campGain(+1)` hors mode
 * groupe / sans bataille. Renvoie `true` si un Avantage a bien été VOLÉ à l'adversaire.
 */
export function reversalStealOne(get: Get, thief: Combatant, victim: Combatant): boolean {
  const battle = get().battle;
  if (!groupAdvantage() || !battle) {
    campGain(get, thief, 1);
    return false;
  }
  const pools = poolsOf(battle);
  const from = advantageCampOf(victim);
  const to = advantageCampOf(thief);
  const stole = pools[from] > 0 && from !== to;
  if (stole) addToPool(pools, from, -1);
  addToPool(pools, to, 1);
  mirrorPools(pools, battle.combatants);
  return stole;
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
  const opposing: AdvantageCamp = own === 'allies' ? 'foes' : 'allies';
  addToPool(pools, opposing, n);
  mirrorPools(pools, battle.combatants);
  return [t('turn.redoutableOpposingFeed', { name: c.label, n })];
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
 *  les porte en camp 'party'/'enemies' (comme `surprise`) ; `startAdvantagePools` les convertit en `AdvantageCamp`. */
type EncounterAdvantageMarkers = Pick<EncounterDef, 'maneuverability' | 'threat' | 'terrain'>;

/** 'party'/'enemies' (naming éditeur, cf. `EncounterDef.surprise`) → `AdvantageCamp` du moteur. */
function markerCamp(side: 'party' | 'enemies'): AdvantageCamp {
  return side === 'party' ? 'allies' : 'foes';
}

/** Réserves de départ (AA 11 l.47-67). AUTO-dérivé de ce que le moteur/la rencontre connaissent au
 *  lancement : Surnombre (ratio de combattants actifs), Surprise (embuscade), et — via les marqueurs
 *  éditables de la rencontre (`EncounterDef.maneuverability`/`.threat`/`.terrain`) — Manœuvrabilité /
 *  Menace / Terrain. Marqueur absent → circonstance non applicable pour cette rencontre. */
export function startAdvantagePools(all: Combatant[], doSurprise: boolean, markers?: EncounterAdvantageMarkers): AdvantagePools {
  const allies = all.filter((c) => c.kind === 'hero' && !isOutOfAction(c)).length;
  const foes = all.filter((c) => c.kind !== 'hero' && !isOutOfAction(c)).length;
  const circ: InitialAdvantageCircumstances = {};
  if (allies > foes && foes > 0) circ.outnumber = { camp: 'allies', ratio: allies / foes };
  else if (foes > allies && allies > 0) circ.outnumber = { camp: 'foes', ratio: foes / allies };
  if (doSurprise) circ.surprise = 'foes'; // l'embuscade de rencontre surprend le groupe (camp adverse)
  if (markers?.maneuverability) circ.maneuverability = markerCamp(markers.maneuverability);
  if (markers?.threat) circ.threat = { camp: markerCamp(markers.threat.camp), tier: markers.threat.tier };
  if (markers?.terrain) circ.terrain = { camp: markerCamp(markers.terrain.camp), heavy: !!markers.terrain.heavy };
  return initialAdvantagePools(circ);
}
