/**
 * BOURSE personnelle d'un Combattant — parts PURES (LDB 61 l.29 : la Bourse est un trapping, id
 * `bourse` de `trappings.json`, champ `money` de son `ItemInstance`). SOURCE UNIQUE de l'arithmétique
 * « où vit l'argent d'un personnage » : le moteur (op `money`) et le state (`bourseFlow` — allocations,
 * cotisations, crédits de groupe) composent CES fonctions, aucun n'en réécrit une seconde.
 *
 * Deux régimes assumés, jamais mélangés : `ensureBourseInstance`/`setBourseBrass` MUTENT le porteur
 * (régime d'`applyOps`, qui écrit dans `target`) ; `ensureBourse`/`withBourseMoney` rendent un CLONE
 * (régime du store Zustand, qui remplace `party`).
 */
import type { Combatant, ItemInstance } from './types';
import { itemFromTrappingById } from './items';
import { fromBrass, toBrass, type Money } from './money';

/** Id de trapping de la Bourse (`trappings.json`) — la seule graphie de cette référence. */
export const BOURSE_TRAPPING_ID = 'bourse';

const ZERO_MONEY: Money = { gold: 0, silver: 0, brass: 0 };

/** Instance `ItemInstance` de la Bourse d'un héros, ou `undefined` s'il n'en a pas. */
export function bourseInstanceOf(hero: Combatant): ItemInstance | undefined {
  return hero.items?.find((i) => i.trappingId === BOURSE_TRAPPING_ID);
}

/** Montant porté par la Bourse d'un héros — `0` s'il n'en a pas (encore). */
export function bourseOf(hero: Combatant): Money {
  return bourseInstanceOf(hero)?.money ?? ZERO_MONEY;
}

/** Garantit l'instance Bourse SUR LE PORTEUR (mutation en place — régime `applyOps`) et la rend.
 *  `undefined` si le catalogue ne résout pas le trapping (donnée absente : l'appelant le nomme). */
export function ensureBourseInstance(hero: Combatant): ItemInstance | undefined {
  const existing = bourseInstanceOf(hero);
  if (existing) return existing;
  const it = itemFromTrappingById(BOURSE_TRAPPING_ID);
  if (!it) return undefined;
  const inst: ItemInstance = { ...it, money: { ...ZERO_MONEY } };
  hero.items = [...(hero.items ?? []), inst];
  return inst;
}

/** Garantit une instance Bourse SUR UN CLONE du héros, créée ici (`itemFromTrappingById`) —
 *  no-op (retourne `hero` tel quel) si déjà présente. Money initialisée à 0. */
export function ensureBourse(hero: Combatant): Combatant {
  if (bourseInstanceOf(hero)) return hero;
  const it = itemFromTrappingById(BOURSE_TRAPPING_ID);
  if (!it) return hero;
  const clone: Combatant = structuredClone(hero);
  clone.items = [...(clone.items ?? []), { ...it, money: { ...ZERO_MONEY } }];
  return clone;
}

/** Pose un montant FIGÉ sur la Bourse d'un héros, en garantissant l'instance au passage — clone pur. */
export function withBourseMoney(hero: Combatant, money: Money): Combatant {
  const ensured = ensureBourse(hero);
  const clone: Combatant = ensured === hero ? structuredClone(hero) : ensured;
  const it = bourseInstanceOf(clone)!;
  it.money = money;
  return clone;
}

/** Porte le solde de la Bourse du porteur à `brass` sous de cuivre, PLANCHER 0 — mutation en place.
 *  Rend le solde RÉELLEMENT posé (0 si le trapping ne résout pas, aucune bourse n'ayant été créée). */
export function setBourseBrass(hero: Combatant, brass: number): number {
  const inst = ensureBourseInstance(hero);
  if (!inst) return 0;
  const pose = Math.max(0, Math.round(brass));
  inst.money = fromBrass(pose);
  return pose;
}

/** Solde de la Bourse en sous de cuivre — unité de compte UNIQUE des ops et des seuils. */
export function bourseBrass(hero: Combatant): number {
  return toBrass(bourseOf(hero));
}
