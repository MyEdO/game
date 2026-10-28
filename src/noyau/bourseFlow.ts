/**
 * Bourse PERSONNELLE par héros (SOCLE POSSESSIONS §8, #531 — arbitrages user 2026-07-20). La monnaie de
 * groupe (`Jeu.money`) disparaît : chaque héros porte SA bourse (instance `ItemInstance` du
 * trapping `bourse`, id `trappings.json:2747`, champ `money`, LDB 61 l.29). Toute somme entrée/sortie est
 * une ALLOCATION sur une ou plusieurs bourses — la bande peut se cotiser (`payWithAllocation`), le
 * bénéficiaire d'un achat est INDÉPENDANT des payeurs. Miroir de `creditPartyMoney`/`merchantFlow`.
 */
import type { Combatant, ItemInstance } from '../engine/types';
import { add as moneyAdd, subtract as moneySub, canAfford, toBrass, fromBrass, type Money } from '../engine/money';
import { bourseInstanceOf, bourseOf, withBourseMoney } from '../engine/bourse';
import { conditionCtx, type ConditionCtx } from '../engine/flowCore';
import type { Get, Set } from './flowTypes';
import type { Jeu } from './etat';
import { actorIn, ecrireActeur } from './monde/combatants';
import { t } from '../i18n';
import { refuserGeste } from './refusVisible';

const ZERO_MONEY: Money = Object.freeze({ gold: 0, silver: 0, brass: 0 }); // #2097

/** Refus d'un geste qui touche la BOURSE ou la CALE du groupe (dépense, vente, bradage, troc, transfert de
 *  cargaison, évaluation de lot) depuis un siège invité (coop) : la raison affichée, ou `null`. Le geste
 *  noyau le lit en tête (`refuserGeste`), l'écran le lit pour fermer sa case. */
export function refusDeGesteSurLeGroupe(s: Pick<Jeu, 'net'>): string | null {
  return s.net.mode === 'guest' ? t('groupe.hoteSeul') : null;
}

/** Tête de geste de groupe : dit `refusDeGesteSurLeGroupe` par `refuserGeste` et rend `true` s'il refuse. */
export function refuseLeGesteDeGroupe(get: Get, set: Set): boolean {
  const refus = refusDeGesteSurLeGroupe(get());
  return refus ? refuserGeste(get, set, refus) : false;
}


/** Somme des bourses des héros — SEULE source d'un affichage d'argent agrégé (il n'y a pas de bourse
 *  de groupe : l'argent vit sur les héros). */
export function partyMoneyTotal(get: Get): Money {
  return totalDesBourses(get().party);
}

/** Somme des bourses d'un groupe donné (forme PURE de `partyMoneyTotal`, pour un verdict sur un état). */
export function totalDesBourses(party: Combatant[]): Money {
  return party.reduce((sum, h) => moneyAdd(sum, bourseOf(h)), ZERO_MONEY);
}

/** `ConditionCtx` de SCÈNE depuis l'état vivant — SOURCE UNIQUE (remplace le `Jeu.money`
 *  disparu) : injecte le total des bourses du groupe (`partyMoneyTotal`) dans la Condition `money`,
 *  au lieu du `s.money` inexistant que `conditionCtx` attend en toute généralité. Tout appelant lisant
 *  l'état de scène (triggers, `if`, choix de dialogue) route DESSUS. */
export function condCtx(get: Get): ConditionCtx {
  return conditionCtx({ flags: get().flags, gameTime: get().gameTime, party: get().party, money: partyMoneyTotal(get), etats: get().etats });
}

/** Pose les Bourses : le montant se calcule UNE fois sur l'acteur lu (`actorIn`), l'instance Bourse
 *  se garantit UNE fois, puis la même s'écrit sur chaque copie (contrat d'`ecrireActeur`, #2312). */
function ecrireBourses(s: Jeu, montants: Record<string, (actuel: Money) => Money>): ReturnType<typeof ecrireActeur> {
  const bourses: Record<string, ItemInstance> = {};
  for (const [id, montant] of Object.entries(montants)) {
    const lu = actorIn(s, id);
    const bourse = lu && bourseInstanceOf(withBourseMoney(lu, montant(bourseOf(lu))));
    if (bourse) bourses[id] = bourse;
  }
  return ecrireActeur(s, Object.keys(bourses), (h) => {
    const bourse = structuredClone(bourses[h.id]!);
    const actuelle = bourseInstanceOf(h);
    const items = h.items ?? [];
    return { ...h, items: actuelle ? items.map((i) => (i === actuelle ? bourse : i)) : [...items, bourse] };
  });
}

/** Crédite la Bourse d'UN héros (atomique, jamais refusée — créditer ne peut pas échouer). */
export function creditBourse(_get: Get, set: Set, heroId: string, m: Money): void {
  set((s) => ecrireBourses(s, { [heroId]: (actuel) => moneyAdd(actuel, m) }));
}

/** Débite la Bourse d'UN héros — refusé (aucune mutation) si insolvable. Renvoie le succès. */
export function debitBourse(get: Get, set: Set, heroId: string, m: Money): boolean {
  const hero = actorIn(get(), heroId);
  if (!hero || !canAfford(bourseOf(hero), m)) return false;
  set((s) => ecrireBourses(s, { [heroId]: (actuel) => moneySub(actuel, m)! }));
  return true;
}

/** Couture de CONSENTEMENT coop : un héros DOIT accepter d'être ponctionné par une cotisation de groupe.
 *  Défaut solo : toujours accordé — câblée per-siège en #619/#627 (point d'ancrage, pas l'implémentation). */
export function canDebitBourse(_heroId: string): boolean {
  return true;
}

/** Débite ATOMIQUEMENT plusieurs bourses pour UN achat (cotisation) — TOUT ou RIEN : si une seule bourse
 *  ponctionnée est insolvable OU refuse le consentement (`consent`), AUCUNE n'est débitée et la
 *  fonction renvoie `false`. `recipient`/`purpose` sont acceptés mais JAMAIS LUS ici (le corps ne
 *  touche que `debits` et `consent`) : aucune journalisation ne les consomme — champs MORTS, #1340.
 *  `consent` : prédicat de consentement par héros,
 *  défaut `canDebitBourse` — seam injectable pour le câblage coop per-siège (#619/#627). */
export function payWithAllocation(
  get: Get,
  set: Set,
  opts: { debits: Record<string, Money>; recipient?: string; purpose?: string; consent?: (heroId: string) => boolean },
): boolean {
  const consent = opts.consent ?? canDebitBourse;
  for (const [heroId, m] of Object.entries(opts.debits)) {
    const hero = actorIn(get(), heroId);
    if (!hero || !consent(heroId) || !canAfford(bourseOf(hero), m)) return false;
  }
  set((s) => ecrireBourses(s, Object.fromEntries(Object.entries(opts.debits).map(([id, m]) => [id, (actuel: Money) => moneySub(actuel, m)!]))));
  return true;
}

/** DÉPENSE DE GROUPE (péage, gages, cargaison) — LE défaut fidèle d'une dépense de bande, miroir DÉBIT
 *  de `distributeCredit` : elle réussit SSI le TOTAL du groupe suffit, jamais sur l'échec du héros fauché
 *  d'un split égal. Si `partyMoneyTotal < cost` → `false`, AUCUNE mutation ; sinon tire GLOUTONNEMENT le
 *  coût des bourses (ORDRE du groupe, chaque héros jusqu'à son solde), ATOMIQUEMENT via `payWithAllocation`
 *  (l'allocation gloutonne est bâtie en cuivre par `toBrass`/`fromBrass`). Renvoie le succès. */
export function payFromGroup(get: Get, set: Set, cost: Money, opts?: { purpose?: string }): boolean {
  if (!canAfford(partyMoneyTotal(get), cost)) return false;
  let remaining = toBrass(cost);
  const debits: Record<string, Money> = {};
  for (const h of get().party) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, toBrass(bourseOf(h)));
    if (take > 0) {
      debits[h.id] = fromBrass(take);
      remaining -= take;
    }
  }
  return payWithAllocation(get, set, { debits, purpose: opts?.purpose });
}

/** DRAINE le groupe pour une PERTE SCRIPTÉE (`giveMoney` négatif) — GLOUTON PLAFONNÉ, miroir de
 *  `payFromGroup` mais jamais tout-ou-rien : une perte supérieure au total du groupe vide TOUTES les
 *  bourses (jusqu'à 0) au lieu d'être esquivée. Prend `min(cost, total)`, dans l'ORDRE du groupe. */
export function drainGroup(get: Get, set: Set, cost: Money): void {
  let remaining = Math.min(toBrass(cost), toBrass(partyMoneyTotal(get)));
  if (remaining <= 0) return;
  const debits: Record<string, Money> = {};
  for (const h of get().party) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, toBrass(bourseOf(h)));
    if (take > 0) {
      debits[h.id] = fromBrass(take);
      remaining -= take;
    }
  }
  payWithAllocation(get, set, { debits, purpose: 'perte' });
}

/** Crédite une somme, répartie par `allocation` (héros→montant) — défaut : PAR TÊTE (`perHead`), reste
 *  au doyen. Miroir crédit de `payWithAllocation`. No-op si le groupe est vide. */
export function distributeCredit(get: Get, set: Set, m: Money, allocation?: Record<string, Money>): void {
  const party = get().party;
  if (!party.length) return;
  const alloc = allocation ?? perHead(party, m);
  set((s) => ecrireBourses(s, Object.fromEntries(Object.entries(alloc).map(([id, m]) => [id, (actuel: Money) => moneyAdd(actuel, m)]))));
}

/** Allocation « un seul payeur » (achat personnel) — utilitaire pour `payWithAllocation`. */
export function soloPayer(heroId: string, m: Money): Record<string, Money> {
  return { [heroId]: m };
}

/** Allocation « par tête » (péage, cotisation par défaut) — division ENTIÈRE en sous de cuivre, le
 *  RESTE (arrondi) au DOYEN (1er héros du groupe). Groupe vide → allocation vide. */
export function perHead(party: Combatant[], m: Money): Record<string, Money> {
  if (!party.length) return {};
  const totalBrass = toBrass(m);
  const n = party.length;
  const share = Math.floor(totalBrass / n);
  const remainder = totalBrass - share * n;
  const result: Record<string, Money> = {};
  party.forEach((h, i) => {
    result[h.id] = fromBrass(share + (i === 0 ? remainder : 0)); // reste au doyen
  });
  return result;
}
