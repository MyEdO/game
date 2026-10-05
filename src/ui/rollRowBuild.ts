/**
 * PORTE UNIQUE du montage d'une rangée de jet (#1262) — le NOYAU (`RollRowCore` → `buildRollRow`) et
 * la FAMILLE de constructeurs qui en dérivent : `participantRow` (l'unité du monteur MULTI),
 * `tableRow` (rangée porte-sélecteur d'un tirage sur table), `drawRow` (tirage VIF sans ligne de
 * jet), `worldRow` (rangée sans acteur), `witnessRow` (témoin d'un jet déjà subi, `rolled` par
 * construction) et `frozenOpposedRow` (témoin à jet figé, calendrier de découverte `opposedFrozen`).
 *
 * Le montage est de l'AFFICHAGE : aucune règle, aucun RNG, et surtout aucune décision de POSSESSION —
 * elle est posée au mint côté `state` (`rollFlowFactory`/`rollSeam.surfaceOf`) et seulement LUE ici.
 *
 * La marque est REQUISE (`BuiltRollRow`) et `RollShell.rows` l'exige : un littéral nu ne compile plus.
 * C'est `tsc` qui tient la porte — le cliquet de comptage qui la tenait pendant la transition est mort
 * avec ce requis.
 */
import type { Combatant } from '../engine/types';
import type { GameState } from '../state/store';
import type { RollRowData } from './RollShell';
import type { PanelRowData } from './RollPanel';
import { maskOpposedRow } from './opposedFrozen';

/**
 * MARQUE D'ORIGINE d'une rangée d'affichage, posée par les constructeurs de CE module. Elle est
 * REQUISE au type et son symbole est NON REPRODUCTIBLE : `Symbol()` (pas `Symbol.for`), non exporté —
 * aucun module tiers ne peut écrire la propriété. Le CAST (`as BuiltRollRow`, sous tableau/générique
 * compris) ET l'ALIAS de type qui le déguiserait (`type A = BuiltRollRow`) sont murés par le lint
 * `murs/marques`, mesurés par `state/built-brand-lint.test.ts`. Ce qui reste ouvert est dit
 * NOMMÉMENT au JSDoc du jumeau `state/stepBrand.ts` (annotation d'une valeur élargie, renommage à
 * l'import) : les mêmes limites, la même liste — aucune couverture affirmée ici qui n'y soit mesurée.
 *
 * Divergence VOULUE avec le jumeau `BuiltCascadeStep` (`declare const`, marque purement typologique) :
 * ici le symbole EXISTE à l'exécution, ce qui garde `isBuiltRollRow` mesurable en vitest — « ce
 * constructeur cesse de poser la marque » reste une mutation ROUGE et rejouable, pas seulement une
 * erreur de compilation. Le prix est nul côté données : `RollRowData` n'est jamais sérialisé
 * (affichage pur), et une propriété à clé Symbol est de toute façon ignorée par `JSON.stringify`.
 *
 * LIMITE, la même qu'au jumeau : le SPREAD blanchit — `{ ...rangéeMontée, winner }` porte encore la
 * marque alors que rien n'a été revérifié. C'est VOULU ici (le post-traitement d'un site est licite et
 * mesuré) ; ce qui est interdit, c'est de FABRIQUER une rangée hors de ce module.
 */
const ROLL_ROW_BRAND: unique symbol = Symbol('wfrp.builtRollRow');

/** Rangée d'affichage MONTÉE par un constructeur de ce module (marque REQUISE — cf. ci-dessus). */
export type BuiltRollRow = RollRowData & { readonly [ROLL_ROW_BRAND]: true };

/** La rangée porte-t-elle la marque ? (le post-traitement par spread la conserve). */
export function isBuiltRollRow(row: RollRowData): boolean {
  // eslint-disable-next-line murs/marques -- #1262 : LECTURE de la marque par le prédicat `isBuiltRollRow`, rien n'est forgé.
  return (row as BuiltRollRow)[ROLL_ROW_BRAND] === true;
}

/** Estampille — site UNIQUE de pose de la marque. */
function mark<T extends RollRowData>(row: T): T & { readonly [ROLL_ROW_BRAND]: true } {
  return { [ROLL_ROW_BRAND]: true, ...row };
}

/**
 * NOYAU d'une rangée MONO — la ligne, le jeteur, les FAITS de son jet, et l'OFFRE de chaque verbe.
 *
 * Aucune ÉLIGIBILITÉ d'influence n'y figure : les fenêtres de la Chance, du Sombre Pacte et de la
 * Résilience sont des prédicats purs du seam (`state/rollFlowFactory.ts`), appliqués au rendu par
 * `RollRow`/`InfluenceRow`. Ce qu'un site déclare, c'est ce qu'il SAIT : l'acteur, la ligne (`row.d`
 * porte le jet et son succès), `rerolled`, et les handlers des verbes qu'il OFFRE — un flux sans
 * Résilience ne passe pas `onForce`, et aucun booléen ne peut la rallumer.
 */
export interface RollRowCore {
  row: PanelRowData;
  /** Le jeteur — porte Chance/Résilience. Absent = rangée sans `Combatant` (vue pure, adversaire
   *  abstrait) : alors le site fournit lui-même les primitives via `extras`. */
  actor?: Combatant;
  /** Une relance a DÉJÀ été consommée sur ce Test (`slot.rerolled`, LDB 12 l.40). */
  rerolled?: boolean;
  /** L'ISSUE du flux est DÉFAVORABLE alors que le jet propre a réussi — Test COMBINÉ dont un volet
   *  tombe (`combinedLevel !== 'full'`, LDB 12 l.202-208), incantation dont le NI n'est pas atteint.
   *  FAIT d'issue, pas une affordance : seule la Résilience s'y ouvre (`LDB 17 l.68`), la Chance
   *  reste jugée sur le jet propre (`LDB 12 l.13`). Absent → l'issue est celle de la ligne, et un
   *  Test opposé la tient déjà de son accent (`winner`). */
  lost?: boolean;
  onRoll?: () => void;
  onReroll?: () => void;
  onDarkPact?: () => void;
  onBonusSL?: () => void;
  onForce?: () => void;
}

/** Extras TYPÉS d'un site : tout `RollRowData` hors noyau et hors `rolled` (dérivé). */
export type RollRowExtras = Omit<RollRowData, keyof RollRowCore | 'rolled'>;

/**
 * MONTEUR MONO — le noyau ci-dessus + les extras TYPÉS du site (`resist`, `reverse`, `extendedDr`,
 * `declare`, `forcedRoll`…). Il pose `rolled` depuis la donnée du jet (`row.d` existe ⇒ le dé est
 * tombé) : DÉFINITION UNIQUE de « la rangée affiche un dé », plus un site pour la recalculer.
 */
export function buildRollRow(core: RollRowCore, extras?: RollRowExtras): BuiltRollRow {
  return mark({ ...core, rolled: !!core.row.d, ...extras });
}

/** Rangée-PARTICIPANT d'un flux MULTI (unité de `buildParticipantRows`) : le noyau + l'identité de
 *  slot (`key`), l'interactivité du siège, le libellé de jet et la barre de Test étendu. */
export interface ParticipantRowCore extends RollRowCore {
  key: string;
  interactive?: boolean;
  rollLabel?: RollRowData['rollLabel'];
  extendedDr?: RollRowData['extendedDr'];
}

export function participantRow(core: ParticipantRowCore): BuiltRollRow {
  const { key, interactive, rollLabel, extendedDr, ...rest } = core;
  return buildRollRow(rest, {
    key,
    ...(interactive !== undefined ? { interactive } : {}),
    ...(rollLabel != null ? { rollLabel } : {}),
    ...(extendedDr ? { extendedDr } : {}),
  });
}

/** Rangée PORTE-SÉLECTEUR d'un tirage sur table : elle n'a ni cible ni DR à pré-afficher, et aucun
 *  `onRoll` — ni bouton de rangée, ni « Lancer » hissé, ni cycle d'influence. Le dé s'y inscrit
 *  (`row.d`) quand le tirage est fait, et `rolled` le suit comme partout ailleurs. */
export function tableRow(core: {
  key: string;
  row: PanelRowData;
  forcedRoll?: RollRowData['forcedRoll'];
  fixedMark?: boolean;
}): BuiltRollRow {
  const { key, row, forcedRoll, fixedMark } = core;
  return buildRollRow({ row }, {
    key,
    ...(forcedRoll ? { forcedRoll } : {}),
    ...(fixedMark !== undefined ? { fixedMark } : {}),
  });
}

/**
 * Rangée de TIRAGE VIF sur une table (Maladresse — Tableau des Oups !, LDB 14) : le tirage se fait
 * DANS la rangée (`onRoll`) et ne laisse AUCUNE ligne de jet — pas de cible, pas de DR, pas de `d` :
 * son seul rendu est la NOTE (`TableRollLine`), qui n'existe qu'une fois le tirage fait. `rolled` s'y
 * dérive donc de la PRÉSENCE DE LA NOTE ; la dérivation du noyau (`!!row.d`) rendrait `false` après
 * le tirage et rallumerait la phase pré-jet sur une rangée qui n'a plus rien à lancer.
 *
 * Forme IRRÉDUCTIBLE au noyau, mesuré : élargir la dérivation à `!!(row.d ?? row.note)` basculerait
 * les rangées-participants, dont la note porte aussi les issues PRÉ-jet (`buildParticipantRows`,
 * `bundle.issues` appelé sans résultat) — d'où un constructeur dédié plutôt qu'un noyau élargi.
 *
 * Sœur de `tableRow` (même absence de ligne de jet), qu'elle ne remplace pas : `tableRow` est le
 * porte-SÉLECTEUR d'un dé forcé, sans `onRoll` ; ici, la rangée lance. Aucun cycle d'influence : la
 * Chance agit AVANT qu'un Test ne devienne une Maladresse ; une fois actée, l'Oups ! est subi.
 */
export function drawRow(core: {
  key?: RollRowData['key'];
  row: PanelRowData;
  rollLabel?: RollRowData['rollLabel'];
  onRoll?: () => void;
  rollFrisson?: boolean;
}): BuiltRollRow {
  const { key, row, rollLabel, onRoll, rollFrisson } = core;
  return mark({
    row,
    rolled: row.note != null,
    ...(key !== undefined ? { key } : {}),
    ...(rollLabel != null ? { rollLabel } : {}),
    ...(onRoll ? { onRoll } : {}),
    ...(rollFrisson !== undefined ? { rollFrisson } : {}),
  });
}

/** Rangée-MONDE (étape sans acteur présentable : désertion, Moral d'une bande) — aucun `Combatant`
 *  n'y porte de Chance/Résilience, le cycle d'influence est donc NUL par construction. */
export function worldRow(core: Omit<RollRowCore, 'actor'>, extras?: RollRowExtras): BuiltRollRow {
  return buildRollRow(core, extras);
}

/**
 * Rangée TÉMOIN d'un jet figé d'adversaire (figée, sans cycle d'influence), masquée jusqu'au jet de
 * réponse (calendrier `opposedFrozen`, #990). `rolled: true` par CONSTRUCTION : le jet figé est déjà
 * tombé même quand sa valeur reste opaque et s'affiche en `pending` (Marchandage, `BargainModal:93`).
 */
export function frozenOpposedRow(
  s: GameState,
  o: { ownerId?: string; responded: boolean; row: PanelRowData },
): BuiltRollRow {
  return maskOpposedRow(s, o, witnessRow({ row: o.row }));
}

/**
 * Rangée TÉMOIN d'un jet DÉJÀ SUBI (pile figée d'une séquence, rangées d'un pas validé) : lecture
 * seule (`interactive:false`, aucun cycle d'influence) et `rolled:true` par CONSTRUCTION — c'est ce
 * qui la distingue du noyau, dont le `rolled` se dérive du dé (`!!row.d`). Un témoin porte parfois
 * une NOTE seule (étape d'affichage/choix validée, pas figé sans ligne de jet) : la dériver rendrait
 * `false` et rallumerait la phase pré-jet sur une rangée qui n'a plus rien à lancer.
 */
export function witnessRow(core: {
  key?: RollRowData['key'];
  row: PanelRowData;
  fixedMark?: boolean;
  extendedDr?: RollRowData['extendedDr'];
}): BuiltRollRow {
  const { key, row, fixedMark, extendedDr } = core;
  return mark({
    row,
    rolled: true,
    interactive: false as const,
    ...(key !== undefined ? { key } : {}),
    ...(fixedMark !== undefined ? { fixedMark } : {}),
    ...(extendedDr ? { extendedDr } : {}),
  });
}
