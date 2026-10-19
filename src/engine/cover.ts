/**
 * COUVERT d'une cible de tir — barème, fusion, et la BIJECTION avec la Difficulté d'un Test.
 *
 * Le canon décrit le couvert de DEUX façons, qui sont la même : la table de difficulté du combat le
 * nomme par un ÉTALON d'objet (`LDB 14 l.72/81/86` — haie, barrière en bois, mur de pierre), le
 * « Tableau des Structures Courantes » par la DIFFICULTÉ qu'un assaillant subit pour tirer sur qui
 * s'y abrite (`AA 10 l.23`, colonne `l.28-51`). Les deux graphies portent le même modificateur ;
 * `couvertDepuisDifficulte` est la seule couture entre elles.
 *
 * PUR : aucune dépendance à la Scène (la géométrie « qui abrite qui » vit en `state/lineOfSight.ts`).
 */
import { COUVERT_DIFFICULTES, DIFFICULTY_MODIFIERS, type CouvertDifficulty, type CoverClass } from './types';

/** Classes de couvert dans l'ordre CROISSANT de protection — parallèle exact de `COUVERT_DIFFICULTES`.
 *  Source unique de l'ordre : la bijection, le cran de dégradation et le classement de l'IA en dérivent. */
export const COVER_ORDER: readonly CoverClass[] = ['none', 'imparfaite', 'moyenne', 'totale'];

/** Classe de couvert → Difficulté de tir sur qui s'y abrite (`LDB 14 l.72/81/86`). */
const couvertEnDifficulte = (c: CoverClass): CouvertDifficulty => COUVERT_DIFFICULTES[COVER_ORDER.indexOf(c)];

/** Modificateur au Test de tir apporté par le couvert de la cible : celui de sa Difficulté. */
export const coverModifier = (c: CoverClass): number => DIFFICULTY_MODIFIERS[couvertEnDifficulte(c)];

/** Le couvert LE PLUS PROTECTEUR des deux (modificateur le plus bas = rang le plus haut). Source UNIQUE
 *  de toute fusion de couvert : terrain × décor × arête au combat, et Améliorations de coque au naval
 *  (`DeckCoverClass ⊂ CoverClass`). */
export const couvertLePlusProtecteur = (a: CoverClass, b: CoverClass): CoverClass =>
  (coverModifier(b) < coverModifier(a) ? b : a);

/** Difficulté de tir → classe de couvert. Bijection sur les quatre Difficultés que la colonne
 *  « Pénalité de Couvert » porte (`AA 10 l.28-51`) : mêmes modificateurs, un rang pour un rang. */
export const couvertDepuisDifficulte = (d: CouvertDifficulty): CoverClass =>
  COVER_ORDER[COUVERT_DIFFICULTES.indexOf(d)];

/** Le couvert dégradé d'UN cran (`AA 10 l.122`, Percée). `none` reste `none` : le canon n'a pas de
 *  cran sous l'absence de couvert. */
export const cranDeCouvertEnMoins = (c: CoverClass): CoverClass => COVER_ORDER[Math.max(0, COVER_ORDER.indexOf(c) - 1)];
