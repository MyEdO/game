/**
 * Surincantation — SOURCE UNIQUE du « que fait un pas de surplus » selon le type de magie, dérivé de
 * la donnée (`spell.family`). Arcane : `LDB 47 l.13-17` ; Miracle : `LDB 42 l.7-13` ; Bénédiction :
 * `LDB 41 l.21-27` ; `magic-vdm-incantation` : `VDM 02 l.194-215`.
 *
 * Pur (consommé par castAllocOvercast/castConfirm/overcastTargetCandidates + CastModal).
 */

import type { GameOp } from './ops';
import type { SpellRange, SpellTarget } from './spellRange';
import type { SpellDuration } from './spellDuration';
import { rule } from './policy';
import surincantationJson from '../data/surincantation.json';
import type { SurincantationData } from '../data/schemas/defs/surincantation';

export type OvercastSource = 'arcane' | 'blessing' | 'miracle';
export type OvercastAxis = 'range' | 'zone' | 'duration' | 'targets' | 'damage';

/** +6 m / +6 Rounds : l'incrément FIXE des Bénédictions (LDB 41 l.23-25). */
const BLESSING_STEP = 6;

/** Type de surincantation d'un sort, DÉRIVÉ de sa famille (spells.json) : `beni` → Bénédiction (FIXE),
 *  `invocation` → Miracle (×initial, sans ZdE), tout le reste (arcane/mineure/chaos/domaines) → Arcane. */
export function overcastSourceOf(spell: { family?: string }): OvercastSource {
  if (spell.family === 'beni') return 'blessing';
  if (spell.family === 'invocation') return 'miracle';
  return 'arcane';
}

/** Axes surincantables d'une source : la Zone d'Effet est réservée à l'arcane (`LDB 41 l.21-27`,
 *  `LDB 42 l.9-11`) ; l'axe Dégâts au Projectile magique sous `VDM 02 l.198` (`LDB 46 l.101`). L'ordre
 *  est celui d'affichage de la modale. */
function overcastAxes(source: OvercastSource, missile: boolean): OvercastAxis[] {
  const base: OvercastAxis[] = source === 'arcane'
    ? ['range', 'zone', 'duration', 'targets']
    : ['range', 'duration', 'targets'];
  return missile && overcastModel(source) === 'vdm' ? [...base, 'damage'] : base;
}

/** Ce que le prédicat des axes lit d'un sort. */
export interface OvercastSpell {
  family?: string;
  range?: SpellRange | null;
  target?: SpellTarget | null;
  duration?: SpellDuration | null;
}

/**
 * Axes de Surincantation PERMIS pour CE sort — prédicat UNIQUE, lu par la modale, par
 * `castAllocOvercast` et par le plan de l'IA. `LDB 47 l.15`, `l.27`, `l.28` ; `LDB 42 l.9-11` ;
 * `LDB 41 l.21-27` ; `VDM 02 l.198-199` ; `CRB 070 l.77-79`.
 */
export function overcastAxesFor(spell: OvercastSpell, missile: boolean): OvercastAxis[] {
  const source = overcastSourceOf(spell);
  const vous = spell.range?.kind === 'self' || spell.target?.kind === 'self';
  const permis: Record<OvercastAxis, boolean> = {
    range: spell.range?.kind === 'distance' || (spell.range?.kind === 'touch' && source === 'blessing'),
    zone: spell.target?.kind === 'area',
    duration: spell.duration?.kind === 'rounds' || spell.duration?.kind === 'clock',
    targets: !vous && spell.target?.kind === 'count',
    damage: true,
  };
  return overcastAxes(source, missile).filter((a) => permis[a]);
}

/**
 * Modèle de Surincantation en vigueur pour une source — POINT DE LECTURE UNIQUE du delta
 * `VDM 02 l.194-215` (règle optionnelle `magic-vdm-incantation`). Les Bénédictions (LDB 41) et les
 * Miracles (LDB 42) ne sont pas des Tests d'Incantation : VDM ne les révise pas.
 */
function overcastModel(source: OvercastSource): 'ldb' | 'vdm' {
  return source === 'arcane' && rule('magic-vdm-incantation') === true ? 'vdm' : 'ldb';
}

/** TABLEAU DE SURINCANTATION (`VDM 02 l.207-215`), LU de la donnée `src/data/surincantation.json` :
 *  DR dépensés sur UNE colonne → effet obtenu. `targets` = Cibles ADDITIONNELLES ;
 *  `range`/`zone`/`duration` = multiplicateurs de la valeur listée ; `damage` = Dégât en plus
 *  (Projectiles magiques uniquement, `VDM 02 l.198`). */
type OvercastRow = SurincantationData['entries'][number];
/** La table EFFECTIVEMENT lue par le moteur — MÊME référence que le module JSON (singleton ESM) :
 *  une édition au Compendium est vue en direct, et la garde de parité (`overcast.test.ts`) refuse
 *  toute ré-inscription en dur (une copie littérale ne serait plus la même référence). */
export const VDM_OVERCAST: OvercastRow[] = (surincantationJson as unknown as SurincantationData).entries;

/** Rangée atteinte par `dr` DR dépensés sur une colonne (le PALIER le plus haut ≤ `dr`) ; `null` en
 *  dessous du plus petit palier. Indépendant de l'ordre d'authoring des rangées. */
function vdmRow(dr: number): OvercastRow | null {
  let best: OvercastRow | null = null;
  for (const r of VDM_OVERCAST) if (dr >= r.dr && (!best || r.dr > best.dr)) best = r;
  return best;
}

/**
 * Surplus de Surincantation pour un DR et un NI donnés — l'arithmétique de `castOvercastBudget`
 * (`magic.ts`), seul site qui lit le NI effectif du jet.
 * LDB 47 l.13-17 / 41 / 42 : un pas coûte +2 DR au-dessus du NI. `VDM 02 l.196` : « le lanceur de
 * sorts peut dépenser les DR restants » — le surplus se dépense DR par DR, sans division.
 *
 * `sl` est le DR OBTENU par le lanceur à son Test d'Incantation (`LDB 47 l.15`), mesuré AVANT toute
 * cible : la Résistance à la Magie réduit le DR du Sort CONTRE une cible (`spellSLFor`), elle n'entre
 * pas dans ce budget. L'asymétrie avec le gate de NI par cible (#1007) est un choix, réf #1023.
 */
export function overcastBudget(source: OvercastSource, sl: number, ni: number): number {
  const surplus = Math.max(0, sl - ni);
  return overcastModel(source) === 'vdm' ? surplus : Math.floor(surplus / 2);
}

/**
 * Coût en DR d'UN pas de Surincantation pour la source donnée — POINT DE LECTURE UNIQUE
 * (modale, tout affichage). `VDM 02 l.196-201` : DR par DR, sans division. LDB : +2 DR par pas.
 */
export function overcastStepCost(source: OvercastSource): number {
  return overcastModel(source) === 'vdm' ? 1 : 2;
}

/** Cibles SUPPLÉMENTAIRES débloquées par `steps` pas alloués à l'axe Cible. Arcane/Miracle : ×initial
 *  (chaque pas ajoute la valeur de Cible initiale du sort) ; Bénédiction : +1 par pas (FIXE). Sous VDM,
 *  `steps` = DR dépensés sur la colonne « Cible additionnelle » du Tableau de Surincantation. */
export function extraTargetCapacity(source: OvercastSource, steps: number, initialTargets: number): number {
  if (overcastModel(source) === 'vdm') return vdmRow(steps)?.targets ?? 0;
  return source === 'blessing' ? steps : steps * Math.max(1, initialTargets);
}

/** Multiplicateur du DIAMÈTRE de Zone d'Effet après `steps` pas alloués à l'axe Zone (arcane seulement).
 *  LDB 47 l.15 : chaque pas ajoute la ZdE initiale (×(1+n)) ; VDM : colonne « ZdE étendue » du Tableau. */
export function zoneDiameterMultiplier(source: OvercastSource, steps: number): number {
  if (overcastModel(source) === 'vdm') return vdmRow(steps)?.zone ?? 1;
  return 1 + steps;
}

/** Décomposition de la Durée surincantée pour l'application : `rounds = base × mult + bonusRounds`.
 *  Arcane/Miracle : mult = 1 + pas, bonus = 0 (×initial — le multiplicateur joue aussi sur une durée
 *  d'HORLOGE). Bénédiction : mult = 1, bonus = 6 Rounds × pas (FIXE, donc rounds-only). SOURCE UNIQUE
 *  de la règle de durée — `applyCast` la consomme. */
export function overcastDurationParts(source: OvercastSource, steps: number): { mult: number; bonusRounds: number } {
  if (overcastModel(source) === 'vdm') return { mult: vdmRow(steps)?.duration ?? 1, bonusRounds: 0 };
  return source === 'blessing' ? { mult: 1, bonusRounds: BLESSING_STEP * steps } : { mult: 1 + steps, bonusRounds: 0 };
}

/** Portée EFFECTIVE (mètres) après `steps` pas de Portée. Arcane/Miracle : base × (1 + pas) ;
 *  Bénédiction : base + 6 m × pas (FIXE — étend même une portée Contact, 0 m, LDB 41 l.27). */
export function effectiveRangeMetres(source: OvercastSource, baseMetres: number, steps: number): number {
  if (overcastModel(source) === 'vdm') return baseMetres * (vdmRow(steps)?.range ?? 1);
  return source === 'blessing' ? baseMetres + BLESSING_STEP * steps : baseMetres * (1 + steps);
}

/** Dégât SUPPLÉMENTAIRE après `steps` DR alloués à la colonne « Dégât en plus » du Tableau de
 *  Surincantation — restreint aux Projectiles magiques (`VDM 02 l.198`) : seul le point de lecture
 *  du Projectile (`missileDamageSL`) appelle cette fonction. Sous le LDB, cet axe n'existe pas
 *  (le DR s'ajoute directement, `LDB 46 l.101`) : renvoie 0. */
export function missileOvercastDamageBonus(source: OvercastSource, steps: number): number {
  return overcastModel(source) === 'vdm' ? (vdmRow(steps)?.damage ?? 0) : 0;
}

/** Le sort porte-t-il un jet sur Tableau COUPLÉ à la Surincantation de Durée (EDOC 13 l.276) ? Détection
 *  PAR LA DONNÉE (`rollTable.extraRollsPerStep` dans son Flow), jamais par id de sort — pilote l'affichage
 *  du choix « Jets sur le Tableau » (déclinable) dans la modale d'incantation. */
export function spellHasOvercastTableRoll(ops: GameOp[]): boolean {
  return ops.some((o) => o.op === 'rollTable' && !!o.extraRollsPerStep);
}
