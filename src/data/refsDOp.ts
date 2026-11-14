/**
 * Réfs de registre du vocabulaire `GameOp` — champs-réfs (`OP_REF_FIELDS`) avec leurs mesures PURES,
 * nommées par le libellé de chaque op au schéma (`OP_LABEL`, `grammaire/mecanique.ts`), partagés par l'atelier,
 * son résumeur et la validation d'une entrée du Codex (`atelierDuCodex.ts`), que tout hôte appelle.
 */
import type { GameOp } from '../engine/ops';
import type { DatasetKey } from './overrides';
import { OP_LABEL } from './schemas/grammaire/mecanique';

/** Champ d'une op portant une RÉFÉRENCE de registre : `ds` = dataset où elle doit résoudre,
 *  `required` = l'op est inapplicable tant que rien n'est élu. Un champ à union FERMÉE (`characteristic`,
 *  `material`, `resource`, `level`…) n'en est pas une : TS y impose déjà l'un de ses N membres. `sauf` = le
 *  champ qui, posé, exclut la réf et la rend non requise (`endPsych.instance`). */
export interface OpRefField { field: string; ds: DatasetKey; label: string; required: boolean; sauf?: string }

/** Valeur d'un champ-réf d'op — `field` est un CHEMIN (`skill.id` pour une référence EMBOÎTÉE,
 *  `traitId` pour une référence à plat). PURE. */
export function opRefValue(op: unknown, field: string): unknown {
  return field.split('.').reduce<unknown>((n, k) => (n && typeof n === 'object' ? (n as Record<string, unknown>)[k] : undefined), op);
}

/** Même chemin, en ÉCRITURE : rend une COPIE de `op` dont `field` porte `valeur`. PURE. */
export function opWithRefValue<T>(op: T, field: string, valeur: unknown): T {
  const [tete, ...reste] = field.split('.');
  const source = op as Record<string, unknown>;
  const sousArbre = reste.length
    ? opWithRefValue((source[tete] ?? {}) as Record<string, unknown>, reste.join('.'), valeur)
    : valeur;
  return { ...source, [tete]: sousArbre } as T;
}

/** SOURCE UNIQUE des réfs de registre du vocabulaire `GameOp`, lue par les contrôles d'édition
 *  (sentinelle vide), par la raison visible portée par la rangée, et par le gate pré-persist du
 *  Codex (`validateEntry`). Un nouveau champ-réf s'ajoute ICI, jamais dans une nième liste. */
export const OP_REF_FIELDS: Partial<Record<GameOp['op'], readonly OpRefField[]>> = {
  condition: [{ field: 'id.id', ds: 'etats', label: 'État', required: true }],
  removeCondition: [{ field: 'id.id', ds: 'etats', label: 'État', required: false }],
  endPsych: [{ field: 'type.id', ds: 'psychologies', label: 'Trait psychologique', required: true, sauf: 'instance' }],
  beginPsych: [{ field: 'type.id', ds: 'psychologies', label: 'État psychologique', required: true }],
  grantPsychTrait: [{ field: 'psychType.id', ds: 'psychologies', label: 'Trait psychologique', required: true }],
  removePsychTrait: [{ field: 'psychType.id', ds: 'psychologies', label: 'Trait psychologique', required: false }],
  grantTrait: [{ field: 'trait.id', ds: 'traits', label: 'Trait', required: true }],
  removeTrait: [{ field: 'trait.id', ds: 'traits', label: 'Trait', required: true }],
  domeWard: [{ field: 'trait.id', ds: 'traits', label: 'Trait', required: true }],
  grantTalent: [{ field: 'talent.id', ds: 'talents', label: 'Talent', required: true }],
  grantCareerTalent: [{ field: 'talent.id', ds: 'talents', label: 'Talent', required: true }],
  grantCareerSkill: [{ field: 'skill.id', ds: 'skills', label: 'Compétence', required: true }],
  skillMod: [{ field: 'skill.id', ds: 'skills', label: 'Compétence', required: true }],
  skillDRBonus: [{ field: 'skill.id', ds: 'skills', label: 'Compétence', required: false }],
  grantReverseToken: [{ field: 'skill.id', ds: 'skills', label: 'Compétence', required: false }],
  castPenalty: [{ field: 'skill.id', ds: 'skills', label: 'Compétence de magie', required: false }],
  suppressSymptom: [{ field: 'symptomId', ds: 'symptoms', label: 'Symptôme', required: true }],
  aggravateSymptom: [{ field: 'disease', ds: 'maladies', label: 'Maladie', required: true }, { field: 'symptomId', ds: 'symptoms', label: 'Symptôme', required: true }],
  attenuateSymptom: [{ field: 'disease', ds: 'maladies', label: 'Maladie', required: true }, { field: 'symptomId', ds: 'symptoms', label: 'Symptôme', required: true }],
  grantSymptom: [{ field: 'disease', ds: 'maladies', label: 'Maladie', required: true }, { field: 'symptomId', ds: 'symptoms', label: 'Symptôme', required: true }],
  rollMutation: [{ field: 'table.id', ds: 'mutationTables', label: 'Table de Corruption', required: true }],
  summon: [{ field: 'ref', ds: 'creatures', label: 'Créature', required: true }],
  polymorph: [{ field: 'ref', ds: 'creatures', label: 'Créature', required: true }],
  scheduleRespawn: [{ field: 'ref', ds: 'creatures', label: 'Créature', required: true }],
  exposeDisease: [{ field: 'disease', ds: 'maladies', label: 'Maladie', required: true }],
  contractDisease: [{ field: 'disease', ds: 'maladies', label: 'Maladie', required: true }],
  reduceDiseaseDays: [{ field: 'disease', ds: 'maladies', label: 'Maladie', required: false }],
  giveTrapping: [{ field: 'trappingId', ds: 'trappings', label: 'Possession', required: false }],
  equipage: [{ field: 'role.id', ds: 'crewRoles', label: 'Rôle d’équipage', required: false }],
  navireHostile: [
    { field: 'navire.id', ds: 'vehicles', label: 'Navire', required: true },
    { field: 'equipage.id', ds: 'creatures', label: 'Équipage type', required: true },
    { field: 'chef.id', ds: 'creatures', label: 'Chef', required: false },
  ],
  manann: [{ field: 'factorId', ds: 'seaManannFactors', label: 'Facteur de l’Humeur de Manann', required: true, sauf: 'delta' }],
  infestation: [{ field: 'crewTestType.id', ds: 'crewTestTypes', label: 'Test d’équipage', required: true }],
  combatEnMer: [{ field: 'adversaire.id', ds: 'creatures', label: 'Adversaire', required: true }],
};

/** Réfs REQUISES non élues d'UNE op (champ absent ou vide) — sans récursion. PURE. */
export function opMissingRefs(op: GameOp): string[] {
  return (OP_REF_FIELDS[op.op] ?? [])
    .filter((f) => f.required && !(f.sauf && opRefValue(op, f.sauf) != null) && (opRefValue(op, f.field) == null || opRefValue(op, f.field) === ''))
    .map((f) => `${OP_LABEL[op.op]} : ${f.label} à choisir`);
}

/** Même mesure sur une valeur QUELCONQUE (liste d'ops, rangée de table, entrée entière de Codex) :
 *  descente générique sur tout nœud portant un `op` — les ops imbriquées (`delayed`, `perRound`,
 *  `transform`, rangées de `rollTable`…) sont couvertes sans énumérer leurs porteurs. PURE. */
export function opsMissingRefs(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(opsMissingRefs);
  if (value == null || typeof value !== 'object') return [];
  const node = value as Record<string, unknown>;
  const own = typeof node.op === 'string' && node.op in OP_LABEL ? opMissingRefs(node as unknown as GameOp) : [];
  return [...own, ...Object.values(node).flatMap(opsMissingRefs)];
}
