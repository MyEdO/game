/**
 * Avantage de GROUPE (AA 11 l.3-67, Annexe I) : SOCLE PUR de la variante où l'Avantage
 * n'est plus accumulé par combattant mais dans DEUX réserves de camp (alliés / adversaires). Ce module
 * ne dépend que de `types` + `policy` (aucun store/UI) — le noyau (`noyau/combat/advantagePool`)
 * l'orchestre sur la `BattleState` (réserve = source de vérité, `Combatant.advantage` = projection).
 *
 * AA 11 l.11-13 : « Les Avantages […] sont acquis et stockés dans la réserve d'Avantages des alliés
 * ou dans celle des adversaires. Chaque fois qu'un Personnage génère un Avantage, placez-le dans la
 * réserve des alliés. Chaque fois qu'un PNJ hostile ou neutre génère un Avantage, placez-le dans la
 * réserve des adversaires. Les PNJ alliés génèrent des Avantages dans la réserve des alliés. »
 */
import type { Combatant } from './types';
import { rule } from './policy';

export type AdvantageCamp = 'allies' | 'foes';

/** Les deux réserves d'Avantage de la bataille (AA 11 l.11). */
export interface AdvantagePools {
  allies: number;
  foes: number;
}

/** Le modèle « Avantage de groupe » (AA 11 l.5) est-il actif ? Registre `combat-aa-avantage-groupe`.
 *  Faux par défaut → modèle par combattant du Livre de base (INCHANGÉ). */
export function groupAdvantage(): boolean {
  return rule('combat-aa-avantage-groupe') === true;
}

/** Réserve d'un combattant : héros et PNJ alliés (`kind:'hero'`) → réserve des alliés ; PNJ hostile ou
 *  neutre (`enemy`/`npc`) → réserve des adversaires (AA 11 l.11-13). */
export function advantageCampOf(c: Pick<Combatant, 'kind'>): AdvantageCamp {
  return c.kind === 'hero' ? 'allies' : 'foes';
}

export function emptyPools(): AdvantagePools {
  return { allies: 0, foes: 0 };
}

/** Ajoute (ou retire) `n` Avantages à la réserve `camp`, jamais sous 0. */
export function addToPool(pools: AdvantagePools, camp: AdvantageCamp, n: number): void {
  pools[camp] = Math.max(0, pools[camp] + n);
}

/** Projette chaque réserve sur le `.advantage` de tous les combattants : les LECTEURS d'Avantage
 *  (`attackModifiers`/`baseTestMods`/`defenseModifiers`, magie) lisent alors la réserve du camp de
 *  l'acteur sans changer une ligne (l'Avantage individuel EST la réserve du camp). */
export function mirrorPools(pools: AdvantagePools, combatants: Combatant[]): void {
  for (const c of combatants) c.advantage = pools[advantageCampOf(c)];
}

// ── Table d'Avantage initial (AA 11 l.51-65) ─────────────────────────────────────────────────────
// « Seul le modificateur le plus élevé applicable à une circonstance donnée doit être accordé pour
//   cette circonstance. Les Avantages sont générés dans la réserve du camp qui en bénéficie. »

/** Niveau de Menace d'un camp (AA 11 l.57-59) : dangereuse=1, très dangereuse=3, extrême=5. */
export type ThreatTier = 'dangereuse' | 'tresDangereuse' | 'extreme';
const THREAT_ADVANTAGE: Record<ThreatTier, number> = { dangereuse: 1, tresDangereuse: 3, extreme: 5 };

export interface InitialAdvantageCircumstances {
  /** Manœuvrabilité (monté, araignées dans les arbres…) : +2 au camp (AA 11 l.56). */
  maneuverability?: AdvantageCamp;
  /** Menace (ogre / manticore / dragon…) : +1/3/5 selon le palier (AA 11 l.57-59). */
  threat?: { camp: AdvantageCamp; tier: ThreatTier };
  /** Surnombre (AA 11 l.60-62) : +1 (>×1), +2 (≥×2), +3 (≥×3) au camp le plus nombreux. */
  outnumber?: { camp: AdvantageCamp; ratio: number };
  /** Surprise : un camp a déclenché un assaut inattendu → +2 (AA 11 l.63). */
  surprise?: AdvantageCamp;
  /** Terrain : couvert léger / position tenue = +1 ; couvert lourd / pont = +2 (AA 11 l.64-65). */
  terrain?: { camp: AdvantageCamp; heavy: boolean };
}

/** Avantage de Surnombre (AA 11 l.60-62) selon le ratio de combattants. */
export function outnumberAdvantage(ratio: number): number {
  if (ratio >= 3) return 3;
  if (ratio >= 2) return 2;
  if (ratio > 1) return 1;
  return 0;
}

/** Réserves de départ selon le positionnement tactique initial (AA 11 l.47-67). Chaque circonstance
 *  crédite la réserve du camp qui en bénéficie. */
export function initialAdvantagePools(circ: InitialAdvantageCircumstances): AdvantagePools {
  const pools = emptyPools();
  if (circ.maneuverability) addToPool(pools, circ.maneuverability, 2);
  if (circ.threat) addToPool(pools, circ.threat.camp, THREAT_ADVANTAGE[circ.threat.tier]);
  if (circ.outnumber) addToPool(pools, circ.outnumber.camp, outnumberAdvantage(circ.outnumber.ratio));
  if (circ.surprise) addToPool(pools, circ.surprise, 2);
  if (circ.terrain) addToPool(pools, circ.terrain.camp, circ.terrain.heavy ? 2 : 1);
  return pools;
}

// ── Transfert de fin de Round (AA 11 l.44) ───────────────────────────────────────────────────────

/**
 * « PERDRE UN AVANTAGE » (AA 11 l.44) : à la fin du Round, le camp DOMINANT (le plus de combattants ;
 * à égalité, celui qui tient l'avantage tactique — non modélisable, on ne transfère pas) prend 1
 * Avantage à la réserve du camp défavorisé ; si celle-ci est vide, le dominant en gagne 1.
 *
 * `weightOf` pondère chaque combattant au décompte (Coude-à-coude variante AA « compte comme deux
 * combattants », AA 13 l.43) ; injecté par la couche state qui connaît les Talents. Mute `pools`.
 */
export function dominationTransfer(
  pools: AdvantagePools,
  combatants: Combatant[],
  active: (c: Combatant) => boolean,
  weightOf: (c: Combatant) => number,
): { dominant: AdvantageCamp | null } {
  let allies = 0;
  let foes = 0;
  for (const c of combatants) {
    if (!active(c)) continue;
    if (advantageCampOf(c) === 'allies') allies += weightOf(c);
    else foes += weightOf(c);
  }
  if (allies === foes) return { dominant: null }; // égalité → arbitrage tactique du MJ, non modélisé
  const dominant: AdvantageCamp = allies > foes ? 'allies' : 'foes';
  const weak: AdvantageCamp = dominant === 'allies' ? 'foes' : 'allies';
  if (pools[weak] > 0) {
    pools[weak] -= 1;
    pools[dominant] += 1;
  } else {
    pools[dominant] += 1;
  }
  return { dominant };
}
