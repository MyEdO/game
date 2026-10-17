/**
 * LECTEUR du registre des RÈGLES OPTIONNELLES (« règles maison ») — SOURCE UNIQUE de la valeur
 * effective d'une règle.
 *
 * Le CATALOGUE (libellé, aide, groupe, forme du contrôle, défaut, bornes, action attachée) vit en
 * DONNÉE : `src/data/reglesOptionnelles.json` (schéma `src/data/schemas/defs/reglesOptionnelles.ts`,
 * éditable au Compendium). Ce module ne garde que les TYPES et la lecture : `rule(id)` = surcharge
 * runtime ⊕ défaut de la donnée. Le panneau in-game (state/houseRules + ui/HouseRulesPanel) écrit la
 * surcharge par `setRule` et la PERSISTE ; il se RÉ-GÉNÈRE depuis le registre (un contrôle par entrée
 * selon `kind`), donc ajouter une règle = ajouter une entrée au JSON, et elle apparaît
 * automatiquement en jeu. Module FEUILLE pur : aucune dépendance store/UI (la persistance vit dans
 * state/, pas ici — le moteur reste pur).
 *
 * Réf. : la citation de chaque règle est portée par son champ `ref` (livre + chapitre, et la ligne
 * quand le passage en porte une) ; les formes réelles sont mesurées au schéma de la donnée.
 */
import reglesOptionnellesJson from '../data/reglesOptionnelles.json';
import { bumperDataset, indexParId } from '../data/versionDataset';
import type { SourceRef } from '../data/schemas/grammaire/valeurs';

/** Forme du contrôle qu'une règle optionnelle fait auto-rendre au panneau in-game : `flag` =
 *  interrupteur, `param` = nombre borné, `mode` = choix parmi `options`. */
export type RuleKind = 'flag' | 'param' | 'mode';
/** Valeur d'une règle optionnelle — union FERMÉE (miroir `ruleValueSchema`, `data/schemas/grammaire/valeurs.ts`). */
export type RuleValue = boolean | number | string;

export interface OptionalRule {
  /** Identifiant stable (clé de surcharge + persistance). */
  id: string;
  type: 'reglesOptionnelles';
  /** Libellé affiché dans le panneau. */
  label: string;
  /** Citation de la règle, montrée en infobulle : livre (`abbr` de `books.json`) + chapitre, plus la
   *  ligne quand le passage en porte une. Formes mesurées : `data/schemas/defs/reglesOptionnelles.ts`. */
  ref: string;
  /** Ancre `{book, page}` de couverture par entrée — folio IMPRIMÉ relevé au marqueur `data-folio`
   *  du passage visé par `ref` (#1318 E8). Absente sur les entrées portant `maison`. */
  source?: SourceRef;
  /** Justification d'une valeur que le RAW ne chiffre pas (CLAUDE.md règle 7) — même sémantique que
   *  `castingNumberMod.maison` (`src/data/schemas/grammaire/valeurs.ts`). Absente = la règle est au RAW. */
  maison?: string;
  /** Sous-système (regroupement dans le panneau). */
  group: string;
  /** Forme du contrôle auto-rendu : flag=toggle, param=nombre, mode=select. */
  kind: RuleKind;
  /** Valeur par défaut (RAW). */
  default: RuleValue;
  /** Valeurs possibles (kind='mode'). */
  options?: string[];
  /** Bornes (kind='param'). */
  min?: number;
  max?: number;
  step?: number;
  /** Aide courte (optionnelle). */
  hint?: string;
  /**
   * ACTION de jeu attachée à la règle, rendue sous sa rangée quand la règle vaut `when` — DÉCLARÉE
   * ICI, sur l'entrée, jamais reconnue par son id dans le panneau (doctrine 2026-07-26 : « "if (id="
   * n'est jamais une solution »). Déclarer une action sur une AUTRE règle = une entrée de donnée,
   * zéro ligne d'UI. `run` nomme l'action du store à déclencher : le moteur ne l'appelle jamais (il
   * reste pur), la vue la résout génériquement sur le store.
   */
  action?: RuleAction;
}

export interface RuleAction {
  /** Valeur de la règle qui rend l'action pertinente. */
  when: RuleValue;
  label: string;
  /**
   * Id du registre d'icônes (`src/ui/icons/`) et nom de l'action du store à déclencher. Tous deux
   * restent des `string` ICI : le moteur est une couche FEUILLE, il ne peut pas importer le type
   * `IconId` (ui) ni les clés du store (state) sans inverser la dépendance. La liaison est donc
   * vérifiée par la garde `src/ui/rule-action-wiring.test.ts` (chaque `icon` existe au registre,
   * chaque `run` désigne une fonction du store), doublée d'un throw DEV au site de résolution
   * (`HouseRulesModal`) : un renommage du store ne peut pas se solder par un bouton disparu.
   */
  icon: string;
  run: string;
}

/**
 * LE registre, LU de la donnée. Ajouter une règle optionnelle = ajouter une entrée à
 * `src/data/reglesOptionnelles.json` (et un SEUL point de lecture dans son module métier via
 * `rule(id)`). Les règles de Test pilotent `testPolicy.getTestPolicy()`. La MÊME référence de
 * tableau que le module JSON (singleton ESM) : une édition au Compendium (`setDataset`, splice en
 * place) est vue en direct par le moteur.
 */
export const OPTIONAL_RULES = reglesOptionnellesJson as unknown as OptionalRule[];

const regleParId = indexParId('reglesOptionnelles', OPTIONAL_RULES);
const overrides = new Map<string, RuleValue>();

/** Définition d'une règle (métadonnée pour l'auto-rendu du panneau). */
export function ruleDef(id: string): OptionalRule | undefined {
  return regleParId(id);
}

/** Valeur EFFECTIVE d'une règle : surcharge runtime si présente, sinon défaut. */
export function rule(id: string): RuleValue {
  if (overrides.has(id)) return overrides.get(id)!;
  return regleParId(id)?.default ?? false;
}

/** Surcharge runtime (depuis le panneau in-game). Ignore un id inconnu. */
export function setRule(id: string, value: RuleValue): void {
  if (!regleParId(id)) return;
  overrides.set(id, value);
  bumperDataset('regles');
}

/** Retire la surcharge → retour au défaut. */
export function resetRule(id: string): void {
  if (overrides.delete(id)) bumperDataset('regles');
}

/** Snapshot des surcharges (pour persistance). */
export function ruleOverrides(): Record<string, RuleValue> {
  return Object.fromEntries(overrides);
}

/** `v` est-elle une valeur de la forme `kind` que déclare `regle` : `flag` booléen, `param` nombre dans ses
 *  bornes, `mode` l'une de ses `options` ? */
export function valeurConforme(regle: Pick<OptionalRule, 'kind' | 'options' | 'min' | 'max'>, v: unknown): v is RuleValue {
  switch (regle.kind) {
    case 'flag':
      return typeof v === 'boolean';
    case 'param':
      return typeof v === 'number' && Number.isFinite(v) && (regle.min === undefined || v >= regle.min) && (regle.max === undefined || v <= regle.max);
    case 'mode':
      return typeof v === 'string' && (regle.options ?? []).includes(v);
  }
}

/** Remplace les surcharges (depuis la persistance). Ignore les ids inconnus et les valeurs non conformes
 *  à leur règle (`valeurConforme`) : le défaut s'applique. */
export function loadRuleOverrides(o: Readonly<Record<string, unknown>>): void {
  overrides.clear();
  for (const [k, v] of Object.entries(o)) {
    const regle = regleParId(k);
    if (regle && valeurConforme(regle, v)) overrides.set(k, v);
  }
}
